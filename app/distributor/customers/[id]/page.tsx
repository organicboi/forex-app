import { requireDistributor } from '@/lib/distributor-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import CustomerDetail from './CustomerDetail'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireDistributor()
  const { id } = await params
  const supabase = createAdminClient()

  const [{ data: customer }, { data: keys }, { data: plans }] = await Promise.all([
    supabase
      .from('v_distributor_overview')
      .select('id, name, is_active, plan_expires_at, is_expired, plan_name, max_branches, branch_count, storage_used_mb, storage_limit_mb')
      .eq('id', id)
      .single(),
    supabase
      .from('license_keys')
      .select('id, label, issued_at, expires_at, redeemed_at, redeemed_by, is_revoked')
      .eq('customer_id', id)
      .order('issued_at', { ascending: false }),
    supabase
      .from('plans')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ])

  if (!customer) notFound()

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/distributor/customers" className="text-zinc-600 hover:text-white text-sm">
          ← Customers
        </Link>
        <span className="text-zinc-700">/</span>
        <h1 className="text-xl font-semibold text-white">{customer.name}</h1>
      </div>
      <CustomerDetail customer={customer} keys={keys ?? []} plans={plans ?? []} customerId={id} />
    </div>
  )
}
