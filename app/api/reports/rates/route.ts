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

  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const currencyId = searchParams.get('currency_id')
  const branchId = searchParams.get('branch_id')

  const supabase = createAdminClient()

  let query = supabase
    .from('rate_history')
    .select('id, currency_id, branch_id, changed_by, source, buy, sell, transfer, changed_at')
    .eq('customer_id', auth.customer_id)
    .order('changed_at', { ascending: false })
    .limit(500)

  if (from) query = query.gte('changed_at', from)
  if (to) query = query.lte('changed_at', to)
  if (currencyId) query = query.eq('currency_id', currencyId)
  if (branchId) {
    if (branchId === '__null__') {
      query = query.is('branch_id', null)
    } else {
      query = query.eq('branch_id', branchId)
    }
  }

  const { data: history, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Parallel lookup tables for enrichment
  const [{ data: currencies }, { data: users }, { data: branches }] = await Promise.all([
    supabase.from('currencies').select('id, code'),
    supabase.from('users').select('id, full_name').eq('customer_id', auth.customer_id),
    supabase.from('branches').select('id, name').eq('customer_id', auth.customer_id),
  ])

  const currencyMap = Object.fromEntries((currencies ?? []).map((c) => [c.id, c.code]))
  const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u.full_name]))
  const branchMap = Object.fromEntries((branches ?? []).map((b) => [b.id, b.name]))

  const rows = (history ?? []).map((h) => ({
    id: h.id,
    changed_at: h.changed_at,
    currency_code: currencyMap[h.currency_id] ?? h.currency_id,
    buy: h.buy,
    sell: h.sell,
    transfer: h.transfer,
    source: h.source,
    changed_by_name: h.changed_by ? (userMap[h.changed_by] ?? 'Unknown') : 'System',
    branch_name: h.branch_id ? (branchMap[h.branch_id] ?? 'Unknown') : null,
  }))

  return Response.json(rows)
}
