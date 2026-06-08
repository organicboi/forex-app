import { NextRequest } from 'next/server'
import { isDistributorRequest } from '@/lib/distributor-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

async function authCheck(request: NextRequest) {
  if (!(await isDistributorRequest(request))) return false
  return true
}

export async function GET(request: NextRequest) {
  if (!(await authCheck(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('v_distributor_overview')
    .select('id, name, is_active, plan_expires_at, is_expired, plan_name, max_branches, branch_count, storage_used_mb, storage_limit_mb')
    .order('name', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!(await authCheck(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const {
    name,
    plan_id,
    expires_days = 365,
    primary_color = '#4c195a',
    base_currency = 'AED',
    business_name,
  } = body ?? {}

  if (!name?.trim()) return Response.json({ error: 'Customer name is required' }, { status: 400 })
  if (!plan_id) return Response.json({ error: 'Plan is required' }, { status: 400 })

  const plan_expires_at = new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString()

  const supabase = createAdminClient()

  // Create customer
  const { data: customer, error: custError } = await supabase
    .from('customers')
    .insert({
      name: name.trim(),
      plan_id,
      plan_expires_at,
      primary_color,
      base_currency,
      business_name: business_name?.trim() || null,
    })
    .select('id, name')
    .single()

  if (custError || !customer) {
    return Response.json({ error: custError?.message ?? 'Failed to create customer' }, { status: 500 })
  }

  // Generate license key — plaintext shown once, only hash stored
  const plaintext = crypto.randomBytes(32).toString('hex')
  const key_hash = crypto.createHash('sha256').update(plaintext).digest('hex')

  await supabase.from('license_keys').insert({
    customer_id: customer.id,
    key_hash,
    label: `Initial key for ${customer.name}`,
  })

  return Response.json({ customer, license_key: plaintext }, { status: 201 })
}
