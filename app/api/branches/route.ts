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

export async function GET() {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  const [{ data: branches }, { data: status }] = await Promise.all([
    supabase
      .from('branches')
      .select('id, name, location_note, layout, allow_user_rate_edit, is_active, created_at, branch_token')
      .eq('customer_id', auth.customer_id)
      .order('created_at', { ascending: true }),
    supabase
      .from('v_branch_screen_status')
      .select('branch_id, screens_online, screens_total, last_seen_at')
      .eq('customer_id', auth.customer_id),
  ])

  const statusMap = Object.fromEntries(
    (status ?? []).map((s) => [s.branch_id, s])
  )

  const result = (branches ?? []).map((b) => ({
    ...b,
    screens_online: statusMap[b.id]?.screens_online ?? 0,
    screens_total: statusMap[b.id]?.screens_total ?? 0,
    last_seen_at: statusMap[b.id]?.last_seen_at ?? null,
  }))

  return Response.json(result)
}

const VALID_LAYOUTS = ['split-standard', 'rates-full', 'ads-full', 'portrait', 'rates-wide']

export async function POST(request: NextRequest) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { name, location_note, layout = 'split-standard' } = body ?? {}

  if (!name?.trim()) {
    return Response.json({ error: 'Branch name is required' }, { status: 400 })
  }
  if (!VALID_LAYOUTS.includes(layout)) {
    return Response.json({ error: 'Invalid layout value' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('branches')
    .insert({
      customer_id: auth.customer_id,
      name: name.trim(),
      location_note: location_note?.trim() || null,
      layout,
    })
    .select('id, name, location_note, layout, allow_user_rate_edit, is_active, created_at, branch_token')
    .single()

  if (error) {
    if (error.message?.includes('Branch limit reached')) {
      return Response.json({ error: error.message }, { status: 403 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data, { status: 201 })
}
