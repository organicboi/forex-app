import { NextRequest } from 'next/server'
import { isDistributorRequest } from '@/lib/distributor-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

async function authCheck(request: NextRequest) {
  return isDistributorRequest(request)
}

export async function GET(request: NextRequest) {
  if (!(await authCheck(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: keys, error } = await supabase
    .from('license_keys')
    .select('id, customer_id, label, issued_at, expires_at, redeemed_at, redeemed_by, is_revoked')
    .order('issued_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Enrich with customer names
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

  return Response.json(rows)
}

export async function POST(request: NextRequest) {
  if (!(await authCheck(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { customer_id, label, expires_at } = body ?? {}

  if (!customer_id) return Response.json({ error: 'customer_id is required' }, { status: 400 })

  const supabase = createAdminClient()

  // Verify customer exists
  const { data: customer } = await supabase
    .from('customers')
    .select('id, name')
    .eq('id', customer_id)
    .single()

  if (!customer) return Response.json({ error: 'Customer not found' }, { status: 404 })

  const plaintext = crypto.randomBytes(32).toString('hex')
  const key_hash = crypto.createHash('sha256').update(plaintext).digest('hex')

  const { data: key, error } = await supabase
    .from('license_keys')
    .insert({
      customer_id,
      key_hash,
      label: label?.trim() || `Key for ${customer.name}`,
      expires_at: expires_at ?? null,
    })
    .select('id, label, issued_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ key, license_key: plaintext }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  if (!(await authCheck(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const body = await request.json().catch(() => null)
  const { is_revoked } = body ?? {}

  if (is_revoked === undefined) return Response.json({ error: 'is_revoked is required' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('license_keys')
    .update({ is_revoked: Boolean(is_revoked) })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
