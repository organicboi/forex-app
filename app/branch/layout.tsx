import { redirect } from 'next/navigation'
import { requireBranchUser } from '@/lib/auth'
import BranchSidebar from './BranchSidebar'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function BranchLayout({ children }: { children: React.ReactNode }) {
  const user = await requireBranchUser()

  const supabase = createAdminClient()
  const { data: assignment } = await supabase
    .from('branch_user_assignments')
    .select('branch_id, branches(name, customer_id, customers(business_name, name, primary_color))')
    .eq('user_id', user.id)
    .single()

  if (!assignment) redirect('/')

  const branchRaw = Array.isArray(assignment.branches) ? assignment.branches[0] : assignment.branches
  const customerRaw = branchRaw
    ? (Array.isArray(branchRaw.customers) ? branchRaw.customers[0] : branchRaw.customers)
    : null

  const branchName: string = branchRaw?.name ?? 'Branch'
  const businessName: string = customerRaw?.business_name ?? customerRaw?.name ?? 'Business'
  const primaryColor: string = customerRaw?.primary_color ?? '#4c195a'

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <BranchSidebar
        branchName={branchName}
        businessName={businessName}
        primaryColor={primaryColor}
        userEmail={user.email}
      />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  )
}
