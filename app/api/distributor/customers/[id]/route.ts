import { NextRequest } from 'next/server'
import { isDistributorRequest } from '@/lib/distributor-auth'
import { createAdminClient } from '@/lib/supabase/admin'

async function authCheck(request: NextRequest) {
  return isDistributorRequest(request)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await authCheck(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const [{ data: customer }, { data: keys }] = await Promise.all([
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
  ])

  if (!customer) return Response.json({ error: 'Customer not found' }, { status: 404 })

  return Response.json({ customer, keys: keys ?? [] })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await authCheck(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

  const { is_active, plan_id, plan_expires_at, name, primary_color, base_currency } = body
  const updates: Partial<{
    is_active: boolean
    plan_id: string
    plan_expires_at: string
    name: string
    primary_color: string
    base_currency: string
  }> = {}

  if (is_active !== undefined) updates.is_active = Boolean(is_active)
  if (plan_id !== undefined) updates.plan_id = plan_id
  if (plan_expires_at !== undefined) updates.plan_expires_at = plan_expires_at
  if (name !== undefined) updates.name = name.trim()
  if (primary_color !== undefined) updates.primary_color = primary_color
  if (base_currency !== undefined) updates.base_currency = base_currency

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
