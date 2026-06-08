import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import RateHistoryReport from './RateHistoryReport'

export default async function RateHistoryPage() {
  const user = await requireAdmin()
  const supabase = createAdminClient()

  // Default: last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: history }, { data: currencies }, { data: branches }, { data: users }] = await Promise.all([
    supabase
      .from('rate_history')
      .select('id, currency_id, branch_id, changed_by, source, buy, sell, transfer, changed_at')
      .eq('customer_id', user.customer_id)
      .gte('changed_at', sevenDaysAgo)
      .order('changed_at', { ascending: false })
      .limit(500),
    supabase
      .from('currencies')
      .select('id, code'),
    supabase
      .from('branches')
      .select('id, name')
      .eq('customer_id', user.customer_id)
      .order('name', { ascending: true }),
    supabase
      .from('users')
      .select('id, full_name')
      .eq('customer_id', user.customer_id),
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Rate History</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Audit log of every rate change. Default shows last 7 days — use filters to narrow down.
        </p>
      </div>
      <RateHistoryReport
        initialRows={rows}
        currencies={currencies ?? []}
        branches={branches ?? []}
      />
    </div>
  )
}
