import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAuthedAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id, customer_id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') return null
  return { user_id: profile.id, customer_id: profile.customer_id }
}

export async function GET(request: NextRequest) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const branchId = request.nextUrl.searchParams.get('branch_id')
  const supabase = createAdminClient()

  let query = supabase
    .from('ticker_messages')
    .select('id, message, display_order, is_active, branch_id')
    .eq('customer_id', auth.customer_id)
    .order('display_order', { ascending: true })

  if (branchId) {
    query = query.eq('branch_id', branchId)
  } else {
    query = query.is('branch_id', null)
  }

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { message, branch_id } = body ?? {}

  if (!message?.trim()) {
    return Response.json({ error: 'Message text is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  if (branch_id) {
    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .eq('id', branch_id)
      .eq('customer_id', auth.customer_id)
      .single()
    if (!branch) return Response.json({ error: 'Branch not found' }, { status: 404 })
  }

  // Get next display_order
  const { data: last } = await supabase
    .from('ticker_messages')
    .select('display_order')
    .eq('customer_id', auth.customer_id)
    .is('branch_id', branch_id ?? null)
    .order('display_order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = (last?.display_order ?? 0) + 1

  const { data, error } = await supabase
    .from('ticker_messages')
    .insert({
      customer_id: auth.customer_id,
      branch_id: branch_id ?? null,
      message: message.trim(),
      display_order: nextOrder,
    })
    .select('id, message, display_order, is_active, branch_id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  // Bulk update: array of { id, message?, is_active?, display_order? }
  if (!Array.isArray(body)) {
    return Response.json({ error: 'Body must be an array' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify all IDs belong to this customer
  const ids = body.map((r: { id: string }) => r.id)
  const { data: owned } = await supabase
    .from('ticker_messages')
    .select('id')
    .eq('customer_id', auth.customer_id)
    .in('id', ids)

  const ownedIds = new Set((owned ?? []).map((r) => r.id))
  if (ids.some((id) => !ownedIds.has(id))) {
    return Response.json({ error: 'One or more messages not found' }, { status: 404 })
  }

  // Upsert each row
  await Promise.all(
    body.map((row: { id: string; message?: string; is_active?: boolean; display_order?: number }) => {
      const updates: Partial<{ message: string; is_active: boolean; display_order: number }> = {}
      if (row.message !== undefined) updates.message = row.message.trim()
      if (row.is_active !== undefined) updates.is_active = Boolean(row.is_active)
      if (row.display_order !== undefined) updates.display_order = Number(row.display_order)
      if (Object.keys(updates).length === 0) return Promise.resolve()
      return supabase.from('ticker_messages').update(updates).eq('id', row.id)
    })
  )

  return Response.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('ticker_messages')
    .select('id')
    .eq('id', id)
    .eq('customer_id', auth.customer_id)
    .single()

  if (!existing) return Response.json({ error: 'Message not found' }, { status: 404 })

  const { error } = await supabase.from('ticker_messages').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
