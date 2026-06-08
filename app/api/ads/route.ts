import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPublicUrl } from '@/lib/r2'

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
    .from('ads')
    .select('id, file_url, file_type, duration_seconds, display_order, is_active, file_size_bytes, original_name, branch_id, created_at')
    .eq('customer_id', auth.customer_id)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

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
  const { key, file_type, duration_seconds = 10, original_name, file_size_bytes, branch_id } = body ?? {}

  if (!key || !file_type) {
    return Response.json({ error: 'Missing key or file_type' }, { status: 400 })
  }
  if (!['image', 'video'].includes(file_type)) {
    return Response.json({ error: 'Invalid file_type' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify branch belongs to this customer if provided
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
  const { data: lastAd } = await supabase
    .from('ads')
    .select('display_order')
    .eq('customer_id', auth.customer_id)
    .is('branch_id', branch_id ?? null)
    .order('display_order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = (lastAd?.display_order ?? 0) + 1

  const { data, error } = await supabase
    .from('ads')
    .insert({
      customer_id: auth.customer_id,
      branch_id: branch_id ?? null,
      file_url: getPublicUrl(key),
      file_type,
      duration_seconds: Number(duration_seconds) || 10,
      display_order: nextOrder,
      file_size_bytes: Number(file_size_bytes) || 0,
      original_name: original_name ?? null,
    })
    .select('id, file_url, file_type, duration_seconds, display_order, is_active, file_size_bytes, original_name, branch_id, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data, { status: 201 })
}
