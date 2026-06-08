import { requireDistributor } from '@/lib/distributor-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import CustomerList from './CustomerList'

export default async function DistributorCustomersPage() {
  await requireDistributor()
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('v_distributor_overview')
    .select('id, name, is_active, plan_expires_at, is_expired, plan_name, max_branches, branch_count, storage_used_mb, storage_limit_mb')
    .order('name', { ascending: true })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Customers</h1>
          <p className="text-zinc-500 text-sm mt-1">{(data ?? []).length} customers total</p>
        </div>
        <Link
          href="/distributor/customers/new"
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Customer
        </Link>
      </div>

      <CustomerList initialCustomers={(data ?? []) as Parameters<typeof CustomerList>[0]['initialCustomers']} />
    </div>
  )
}
