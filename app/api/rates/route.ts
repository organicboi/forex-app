import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAuthedAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('id, customer_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return null
  return { user_id: profile.id, customer_id: profile.customer_id }
}

export async function GET() {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  // Fetch currencies + current rates in one join
  const { data, error } = await supabase
    .from('customer_currencies')
    .select(`
      currency_id,
      is_enabled,
      display_order,
      decimal_places,
      currencies (
        code,
        name,
        flag_path,
        default_decimals
      ),
      rates!inner (
        buy,
        sell,
        transfer,
        mode,
        updated_at
      )
    `)
    .eq('customer_id', auth.customer_id)
    .eq('is_enabled', true)
    .order('display_order', { ascending: true })

  if (error) {
    // rates join might fail if no rate row exists — fetch without inner join
    const { data: fallback, error: fallbackError } = await supabase
      .from('customer_currencies')
      .select(`
        currency_id,
        is_enabled,
        display_order,
        decimal_places,
        currencies (
          code,
          name,
          flag_path,
          default_decimals
        )
      `)
      .eq('customer_id', auth.customer_id)
      .eq('is_enabled', true)
      .order('display_order', { ascending: true })

    if (fallbackError) return Response.json({ error: fallbackError.message }, { status: 500 })

    return Response.json(
      (fallback ?? []).map((row) => ({
        ...row,
        rates: [{ buy: 0, sell: 0, transfer: 0, mode: 'manual', updated_at: null }],
      }))
    )
  }

  return Response.json(data)
}

export async function POST(request: NextRequest) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!Array.isArray(body)) {
    return Response.json({ error: 'Body must be an array' }, { status: 400 })
  }

  // Validate
  for (const row of body) {
    const buy = Number(row.buy)
    const sell = Number(row.sell)
    const transfer = Number(row.transfer)
    if (isNaN(buy) || isNaN(sell) || isNaN(transfer)) {
      return Response.json({ error: `Invalid numbers for currency ${row.currency_id}` }, { status: 400 })
    }
    if (buy < 0 || sell < 0 || transfer < 0) {
      return Response.json({ error: `Rates cannot be negative for currency ${row.currency_id}` }, { status: 400 })
    }
  }

  const supabase = createAdminClient()

  // Check plan is active
  const { data: customer } = await supabase
    .from('customers')
    .select('plan_expires_at, is_active')
    .eq('id', auth.customer_id)
    .single()

  if (!customer?.is_active || new Date(customer.plan_expires_at) < new Date()) {
    return Response.json({ error: 'Plan expired or account inactive' }, { status: 403 })
  }

  const upserts = body.map((row: { currency_id: string; buy: number; sell: number; transfer: number }) => ({
    customer_id: auth.customer_id,
    currency_id: row.currency_id,
    buy: Number(row.buy),
    sell: Number(row.sell),
    transfer: Number(row.transfer),
    mode: 'manual' as const,
    updated_by: auth.user_id,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('rates')
    .upsert(upserts, { onConflict: 'customer_id,currency_id' })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
