import { requireAdmin, getCustomerWithPlan, isPlanExpired } from '@/lib/auth'

export default async function PlanPage() {
  const user = await requireAdmin()
  const customer = await getCustomerWithPlan(user.customer_id)

  if (!customer) return null

  const expired = isPlanExpired(customer.plan_expires_at)
  const expiryDate = new Date(customer.plan_expires_at).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Plan & Billing</h1>
        <p className="text-zinc-500 text-sm mt-1">Your current subscription details.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 max-w-2xl">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-medium">Current Plan</h2>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              expired
                ? 'bg-red-950 text-red-400 border border-red-900'
                : 'bg-green-950 text-green-400 border border-green-900'
            }`}>
              {expired ? 'Expired' : 'Active'}
            </span>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Expiry</span>
              <span className={expired ? 'text-red-400' : 'text-zinc-200'}>{expiryDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Max Branches</span>
              <span className="text-zinc-200">{customer.plan.max_branches}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Ad Storage</span>
              <span className="text-zinc-200">{customer.plan.storage_mb >= 1024
                ? `${(customer.plan.storage_mb / 1024).toFixed(1)} GB`
                : `${customer.plan.storage_mb} MB`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Live Rate Feeds</span>
              <span className={customer.plan.allow_live_rates ? 'text-green-400' : 'text-zinc-600'}>
                {customer.plan.allow_live_rates ? 'Included' : 'Not included'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Excel Import</span>
              <span className={customer.plan.allow_excel_import ? 'text-green-400' : 'text-zinc-600'}>
                {customer.plan.allow_excel_import ? 'Included' : 'Not included'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Branch Rate Overrides</span>
              <span className={customer.plan.allow_branch_rate_edit ? 'text-green-400' : 'text-zinc-600'}>
                {customer.plan.allow_branch_rate_edit ? 'Included' : 'Not included'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-sm text-zinc-500">
          To renew or upgrade your plan, contact your provider with your account email: <span className="text-zinc-300">{user.email}</span>
        </div>
      </div>
    </div>
  )
}
