import { redirect } from 'next/navigation'
import { requireAdmin, getCustomerWithPlan, isPlanExpired, isPlanExpiringSoon } from '@/lib/auth'
import AdminSidebar from './AdminSidebar'
import { ToastProvider } from './ToastContext'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()
  const customer = await getCustomerWithPlan(user.customer_id)

  if (!customer) redirect('/')

  const expired = isPlanExpired(customer.plan_expires_at)
  const expiringSoon = !expired && isPlanExpiringSoon(customer.plan_expires_at)
  const expiryDate = new Date(customer.plan_expires_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <AdminSidebar
        businessName={customer.business_name ?? customer.name}
        primaryColor={customer.primary_color}
        userEmail={user.email}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {expired && (
          <div className="bg-red-950/60 border-b border-red-900 text-red-300 px-6 py-2.5 text-sm flex-shrink-0">
            <strong>Subscription expired.</strong> The platform is read-only. Contact your provider to renew.
          </div>
        )}
        {expiringSoon && (
          <div className="bg-amber-950/60 border-b border-amber-900 text-amber-300 px-6 py-2.5 text-sm flex-shrink-0">
            Your subscription expires on <strong>{expiryDate}</strong>. Contact your provider to renew.
          </div>
        )}
        <ToastProvider>
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </ToastProvider>
      </div>
    </div>
  )
}
