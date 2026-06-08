import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAuthedBranchUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('id, customer_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'branch_user') return null

  const admin = createAdminClient()
  const { data: assignment } = await admin
    .from('branch_user_assignments')
    .select('branch_id, branches(customer_id, allow_user_rate_edit)')
    .eq('user_id', user.id)
    .single()

  if (!assignment) return null

  const branchRaw = Array.isArray(assignment.branches) ? assignment.branches[0] : assignment.branches
  if (!branchRaw) return null

  return {
    user_id: profile.id,
    customer_id: profile.customer_id,
    branch_id: assignment.branch_id,
    allow_user_rate_edit: branchRaw.allow_user_rate_edit ?? false,
  }
}

export async function GET() {
  const ctx = await getAuthedBranchUser()
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  const [{ data: ccRows }, { data: rateRows }, { data: overrideRows }] = await Promise.all([
    supabase
      .from('customer_currencies')
      .select('currency_id, is_enabled, display_order, decimal_places, currencies(code, name, flag_path, default_decimals)')
      .eq('customer_id', ctx.customer_id)
      .eq('is_enabled', true)
      .order('display_order', { ascending: true }),
    supabase
      .from('rates')
      .select('currency_id, buy, sell, transfer, mode, updated_at')
      .eq('customer_id', ctx.customer_id),
    supabase
      .from('branch_rate_overrides')
      .select('currency_id, buy, sell, transfer, updated_at')
      .eq('branch_id', ctx.branch_id),
  ])

  const rateMap = Object.fromEntries((rateRows ?? []).map((r) => [r.currency_id, r]))
  const overrideMap = Object.fromEntries((overrideRows ?? []).map((r) => [r.currency_id, r]))

  const merged = (ccRows ?? []).map((cc) => {
    const base = rateMap[cc.currency_id] ?? { buy: 0, sell: 0, transfer: 0, mode: 'manual', updated_at: null }
    const override = overrideMap[cc.currency_id] ?? null
    return {
      currency_id: cc.currency_id,
      decimal_places: cc.decimal_places,
      currencies: cc.currencies,
      base_rate: base,
      override: override,
      effective: override ?? base,
    }
  })

  return Response.json({
    rows: merged,
    allow_edit: ctx.allow_user_rate_edit,
    branch_id: ctx.branch_id,
  })
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthedBranchUser()
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  if (!ctx.allow_user_rate_edit) {
    return Response.json({ error: 'Rate editing is not enabled for this branch' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!Array.isArray(body)) {
    return Response.json({ error: 'Body must be an array' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Validate plan
  const { data: customer } = await supabase
    .from('customers')
    .select('plan_expires_at, is_active')
    .eq('id', ctx.customer_id)
    .single()

  if (!customer?.is_active || new Date(customer.plan_expires_at) < new Date()) {
    return Response.json({ error: 'Plan expired or account inactive' }, { status: 403 })
  }

  // Validate values
  for (const row of body) {
    const buy = Number(row.buy)
    const sell = Number(row.sell)
    const transfer = Number(row.transfer)
    if (isNaN(buy) || isNaN(sell) || isNaN(transfer) || buy < 0 || sell < 0 || transfer < 0) {
      return Response.json({ error: `Invalid rate values for currency ${row.currency_id}` }, { status: 400 })
    }
  }

  const upserts = body.map((row: { currency_id: string; buy: number; sell: number; transfer: number }) => ({
    branch_id: ctx.branch_id,
    currency_id: row.currency_id,
    buy: Number(row.buy) || 0,
    sell: Number(row.sell) || 0,
    transfer: Number(row.transfer) || 0,
    updated_by: ctx.user_id,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('branch_rate_overrides')
    .upsert(upserts, { onConflict: 'branch_id,currency_id' })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
