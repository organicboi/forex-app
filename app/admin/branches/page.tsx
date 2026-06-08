import { requireAdmin, getCustomerWithPlan } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import BranchList from './BranchList'

export default async function BranchesPage() {
  const user = await requireAdmin()
  const customer = await getCustomerWithPlan(user.customer_id)
  const supabase = createAdminClient()

  const [{ data: branches }, { data: status }] = await Promise.all([
    supabase
      .from('branches')
      .select('id, name, location_note, layout, allow_user_rate_edit, is_active, created_at, branch_token')
      .eq('customer_id', user.customer_id)
      .order('created_at', { ascending: true }),
    supabase
      .from('v_branch_screen_status')
      .select('branch_id, screens_online, screens_total')
      .eq('customer_id', user.customer_id),
  ])

  const statusMap = Object.fromEntries(
    (status ?? []).map((s) => [s.branch_id, s])
  )

  const merged = (branches ?? []).map((b) => ({
    ...b,
    screens_online: statusMap[b.id]?.screens_online ?? 0,
    screens_total: statusMap[b.id]?.screens_total ?? 0,
  }))

  return (
    <BranchList
      initialBranches={merged}
      maxBranches={customer?.plan.max_branches ?? 5}
    />
  )
}
