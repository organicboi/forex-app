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

async function verifyScreen(screenId: string, customerId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('screens')
    .select('id')
    .eq('id', screenId)
    .eq('customer_id', customerId)
    .single()
  return data
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!await verifyScreen(id, auth.customer_id)) {
    return Response.json({ error: 'Screen not found' }, { status: 404 })
  }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('screen_ads')
    .select('ad_id, display_order')
    .eq('screen_id', id)
    .order('display_order', { ascending: true })

  return Response.json(data ?? [])
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!await verifyScreen(id, auth.customer_id)) {
    return Response.json({ error: 'Screen not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.ad_ids)) {
    return Response.json({ error: 'Expected { ad_ids: string[] }' }, { status: 400 })
  }

  const adIds: string[] = body.ad_ids
  const supabase = createAdminClient()

  if (adIds.length > 0) {
    const { data: validAds } = await supabase
      .from('ads')
      .select('id')
      .in('id', adIds)
      .eq('customer_id', auth.customer_id)

    const validSet = new Set((validAds ?? []).map((a) => a.id))
    if (adIds.some((aid) => !validSet.has(aid))) {
      return Response.json({ error: 'One or more ad IDs are invalid' }, { status: 400 })
    }
  }

  await supabase.from('screen_ads').delete().eq('screen_id', id)

  if (adIds.length > 0) {
    const rows = adIds.map((ad_id, idx) => ({ screen_id: id, ad_id, display_order: idx }))
    const { error } = await supabase.from('screen_ads').insert(rows)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, count: adIds.length })
}
