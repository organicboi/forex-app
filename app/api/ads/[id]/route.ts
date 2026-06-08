import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteR2Object, getKeyFromUrl } from '@/lib/r2'

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)

  const { is_active, duration_seconds, display_order } = body ?? {}
  const updates: Partial<{ is_active: boolean; duration_seconds: number; display_order: number }> = {}

  if (is_active !== undefined) updates.is_active = Boolean(is_active)
  if (duration_seconds !== undefined) updates.duration_seconds = Number(duration_seconds) || 10
  if (display_order !== undefined) updates.display_order = Number(display_order)

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('ads')
    .select('id')
    .eq('id', id)
    .eq('customer_id', auth.customer_id)
    .single()

  if (!existing) return Response.json({ error: 'Ad not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('ads')
    .update(updates)
    .eq('id', id)
    .select('id, is_active, duration_seconds, display_order')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const { data: ad } = await supabase
    .from('ads')
    .select('id, file_url')
    .eq('id', id)
    .eq('customer_id', auth.customer_id)
    .single()

  if (!ad) return Response.json({ error: 'Ad not found' }, { status: 404 })

  // Delete from R2 first, then DB
  try {
    const key = getKeyFromUrl(ad.file_url)
    await deleteR2Object(key)
  } catch {
    // R2 deletion is best-effort — continue with DB delete
  }

  const { error } = await supabase.from('ads').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
