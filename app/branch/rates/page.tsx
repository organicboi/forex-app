import { requireBranchUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import BranchRateView from './BranchRateView'

export default async function BranchRatesPage() {
  const user = await requireBranchUser()
  const supabase = createAdminClient()

  const { data: assignment } = await supabase
    .from('branch_user_assignments')
    .select('branch_id, branches(customer_id, allow_user_rate_edit)')
    .eq('user_id', user.id)
    .single()

  if (!assignment) return null

  const branchRaw = Array.isArray(assignment.branches) ? assignment.branches[0] : assignment.branches
  const customerId = branchRaw?.customer_id ?? user.customer_id
  const allowEdit = branchRaw?.allow_user_rate_edit ?? false
  const branchId = assignment.branch_id

  const [{ data: ccRows }, { data: rateRows }, { data: overrideRows }] = await Promise.all([
    supabase
      .from('customer_currencies')
      .select('currency_id, is_enabled, display_order, decimal_places, currencies(code, name, flag_path, default_decimals)')
      .eq('customer_id', customerId)
      .eq('is_enabled', true)
      .order('display_order', { ascending: true }),
    supabase
      .from('rates')
      .select('currency_id, buy, sell, transfer, mode, updated_at')
      .eq('customer_id', customerId),
    supabase
      .from('branch_rate_overrides')
      .select('currency_id, buy, sell, transfer, updated_at')
      .eq('branch_id', branchId),
  ])

  const rateMap = Object.fromEntries((rateRows ?? []).map((r) => [r.currency_id, r]))
  const overrideMap = Object.fromEntries((overrideRows ?? []).map((r) => [r.currency_id, r]))

  const rows = (ccRows ?? []).map((cc) => {
    const base = rateMap[cc.currency_id] ?? { buy: 0, sell: 0, transfer: 0, mode: 'manual', updated_at: null }
    const override = overrideMap[cc.currency_id] ?? null
    return {
      currency_id: cc.currency_id,
      decimal_places: cc.decimal_places,
      currencies: cc.currencies,
      base_rate: base,
      override,
      effective: override ?? base,
    }
  })

  return (
    <BranchRateView
      rows={rows as unknown as Parameters<typeof BranchRateView>[0]['rows']}
      allowEdit={allowEdit}
    />
  )
}
