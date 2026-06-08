import { requireDistributor } from '@/lib/distributor-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function UsagePage() {
  await requireDistributor()
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('v_distributor_overview')
    .select('id, name, is_active, plan_name, branch_count, max_branches, storage_used_mb, storage_limit_mb, is_expired')
    .order('storage_used_mb', { ascending: false })

  const customers = data ?? []
  const totalStorage = customers.reduce((s, c) => s + c.storage_used_mb, 0)
  const activeBranches = customers.reduce((s, c) => s + c.branch_count, 0)
  const activeCustomers = customers.filter((c) => c.is_active && !c.is_expired).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">System Usage</h1>
        <p className="text-zinc-500 text-sm mt-1">Platform-wide metrics across all customers.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Customers', value: customers.length },
          { label: 'Active Customers', value: activeCustomers },
          { label: 'Active Branches', value: activeBranches },
          { label: 'Total Storage', value: `${totalStorage.toFixed(0)} MB` },
        ].map((stat) => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-zinc-500 text-xs mb-2">{stat.label}</div>
            <div className="text-white text-2xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Per-customer breakdown */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Customer</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Plan</th>
              <th className="text-right px-4 py-3 text-zinc-500 font-medium">Branches</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Storage</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const storagePct = c.storage_limit_mb > 0
                ? Math.min(100, (c.storage_used_mb / c.storage_limit_mb) * 100)
                : 0
              return (
                <tr key={c.id} className="border-b border-zinc-800/40 last:border-0">
                  <td className="px-4 py-2.5 text-white font-medium text-sm">{c.name}</td>
                  <td className="px-4 py-2.5 text-zinc-400 text-xs">{c.plan_name}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-300 text-xs">
                    {c.branch_count} / {c.max_branches}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            storagePct > 90 ? 'bg-red-500' : storagePct > 70 ? 'bg-yellow-500' : 'bg-purple-500'
                          }`}
                          style={{ width: `${storagePct}%` }}
                        />
                      </div>
                      <span className="text-zinc-500 text-xs">{c.storage_used_mb.toFixed(0)} MB</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      !c.is_active ? 'bg-zinc-800 text-zinc-500' :
                      c.is_expired ? 'bg-red-900/40 text-red-400' :
                      'bg-green-900/40 text-green-400'
                    }`}>
                      {!c.is_active ? 'Inactive' : c.is_expired ? 'Expired' : 'Active'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
