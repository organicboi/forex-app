import { requireDistributor } from '@/lib/distributor-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import NewCustomerForm from './NewCustomerForm'

export default async function NewCustomerPage() {
  await requireDistributor()
  const supabase = createAdminClient()

  const { data: plans } = await supabase
    .from('plans')
    .select('id, name, max_branches, storage_mb, duration_days')
    .eq('is_active', true)
    .order('name', { ascending: true })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">New Customer</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Creates the customer account and generates an initial license key.
        </p>
      </div>
      <NewCustomerForm plans={plans ?? []} />
    </div>
  )
}
