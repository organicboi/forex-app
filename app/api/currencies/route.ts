import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAuthedCustomer() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('customer_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return null
  return { user, customer_id: profile.customer_id }
}

export async function GET() {
  const auth = await getAuthedCustomer()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('customer_currencies')
    .select(`
      id,
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
    .order('display_order', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data)
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthedCustomer()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!Array.isArray(body)) {
    return Response.json({ error: 'Body must be an array' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const updates = body.map((row: {
    currency_id: string
    is_enabled: boolean
    display_order: number
    decimal_places: number | null
  }) => ({
    customer_id: auth.customer_id,
    currency_id: row.currency_id,
    is_enabled: row.is_enabled,
    display_order: row.display_order,
    decimal_places: row.decimal_places ?? null,
  }))

  const { error } = await supabase
    .from('customer_currencies')
    .upsert(updates, { onConflict: 'customer_id,currency_id' })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
