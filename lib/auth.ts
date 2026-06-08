import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export interface SessionUser {
  id: string
  email: string
  customer_id: string
  role: 'admin' | 'branch_user'
  full_name: string
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('customer_id, role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  return {
    id: user.id,
    email: profile.email,
    customer_id: profile.customer_id,
    role: profile.role as 'admin' | 'branch_user',
    full_name: profile.full_name,
  }
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user || user.role !== 'admin') redirect('/')
  return user
}

export async function requireBranchUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user || user.role !== 'branch_user') redirect('/')
  return user
}

export interface CustomerWithPlan {
  id: string
  name: string
  business_name: string | null
  primary_color: string
  base_currency: string
  plan_expires_at: string
  is_active: boolean
  plan: {
    max_branches: number
    storage_mb: number
    allow_live_rates: boolean
    allow_excel_import: boolean
    allow_layout_config: boolean
    allow_branch_rate_edit: boolean
  }
}

export async function getCustomerWithPlan(customer_id: string): Promise<CustomerWithPlan | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('customers')
    .select(`
      id, name, business_name, primary_color, base_currency,
      plan_expires_at, is_active,
      plans(max_branches, storage_mb, allow_live_rates, allow_excel_import, allow_layout_config, allow_branch_rate_edit)
    `)
    .eq('id', customer_id)
    .single()

  if (!data) return null

  const planRaw = data.plans
  const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw

  return {
    id: data.id,
    name: data.name,
    business_name: data.business_name,
    primary_color: data.primary_color,
    base_currency: data.base_currency,
    plan_expires_at: data.plan_expires_at,
    is_active: data.is_active,
    plan: plan as CustomerWithPlan['plan'],
  }
}

export function isPlanExpired(plan_expires_at: string): boolean {
  return new Date(plan_expires_at) < new Date()
}

export function isPlanExpiringSoon(plan_expires_at: string): boolean {
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  return new Date(plan_expires_at).getTime() - Date.now() < sevenDays
}
