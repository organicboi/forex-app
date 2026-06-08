import { requireDistributor } from '@/lib/distributor-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import KeyManager from './KeyManager'

export default async function KeysPage() {
  await requireDistributor()
  const supabase = createAdminClient()

  const { data: keys } = await supabase
    .from('license_keys')
    .select('id, customer_id, label, issued_at, expires_at, redeemed_at, redeemed_by, is_revoked')
    .order('issued_at', { ascending: false })

  const customerIds = [...new Set((keys ?? []).map((k) => k.customer_id))]
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name')
    .in('id', customerIds.length > 0 ? customerIds : ['00000000-0000-0000-0000-000000000000'])

  const customerMap = Object.fromEntries((customers ?? []).map((c) => [c.id, c.name]))

  const rows = (keys ?? []).map((k) => ({
    ...k,
    customer_name: customerMap[k.customer_id] ?? 'Unknown',
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">License Keys</h1>
        <p className="text-zinc-500 text-sm mt-1">All keys across all customers. Revoke individual keys here.</p>
      </div>
      <KeyManager initialKeys={rows} />
    </div>
  )
}
