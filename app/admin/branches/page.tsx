import { requireAdmin, getCustomerWithPlan } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import BranchList from './BranchList'

export default async function BranchesPage() {
  const user = await requireAdmin()
  const customer = await getCustomerWithPlan(user.customer_id)
  const supabase = createAdminClient()

  const [{ data: branches }, { data: statusRows }, { data: screensData }] = await Promise.all([
    supabase
      .from('branches')
      .select('id, name, location_note, layout, allow_user_rate_edit, is_active, created_at, branch_token')
      .eq('customer_id', user.customer_id)
      .order('created_at', { ascending: true }),
    supabase
      .from('v_branch_screen_status')
      .select('branch_id, screens_online, screens_total')
      .eq('customer_id', user.customer_id),
    supabase
      .from('screens')
      .select('branch_id, template_id, display_templates(name)')
      .eq('customer_id', user.customer_id),
  ])

  const statusMap = Object.fromEntries(
    (statusRows ?? []).map((s) => [s.branch_id, s])
  )

  // Build per-branch screen count and template names
  const screenCountMap: Record<string, number> = {}
  const templateNamesMap: Record<string, string[]> = {}

  for (const s of screensData ?? []) {
    screenCountMap[s.branch_id] = (screenCountMap[s.branch_id] ?? 0) + 1
    const tpl = s.display_templates as unknown as { name: string } | null
    if (tpl?.name) {
      const existing = templateNamesMap[s.branch_id] ?? []
      if (!existing.includes(tpl.name)) {
        templateNamesMap[s.branch_id] = [...existing, tpl.name]
      }
    }
  }

  const merged = (branches ?? []).map((b) => ({
    ...b,
    screens_online: statusMap[b.id]?.screens_online ?? 0,
    screens_total: statusMap[b.id]?.screens_total ?? 0,
    configured_screens: screenCountMap[b.id] ?? 0,
    templates_used: templateNamesMap[b.id] ?? [],
  }))

  return (
    <BranchList
      initialBranches={merged}
      maxBranches={customer?.plan.max_branches ?? 5}
    />
  )
}
