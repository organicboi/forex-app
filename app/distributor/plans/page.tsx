import { requireDistributor } from '@/lib/distributor-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import PlanManager from './PlanManager'

export default async function PlansPage() {
  await requireDistributor()
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('plans')
    .select('id, name, max_branches, storage_mb, allow_live_rates, allow_excel_import, allow_layout_config, allow_branch_rate_edit, duration_days, price_note, is_active, created_at')
    .order('name', { ascending: true })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Subscription Plans</h1>
        <p className="text-zinc-500 text-sm mt-1">Define plan tiers available to customers.</p>
      </div>
      <PlanManager initialPlans={(data ?? []) as Parameters<typeof PlanManager>[0]['initialPlans']} />
    </div>
  )
}
