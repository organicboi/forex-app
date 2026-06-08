import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const { key, email, password, full_name } = body ?? {}

  if (!key || !email || !password) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const keyHash = crypto.createHash('sha256').update(key).digest('hex')

  const { data: licenseKey } = await supabase
    .from('license_keys')
    .select('id, customer_id, redeemed_at, expires_at, is_revoked')
    .eq('key_hash', keyHash)
    .single()

  if (!licenseKey) {
    return Response.json({ error: 'Invalid license key' }, { status: 401 })
  }

  if (licenseKey.is_revoked) {
    return Response.json({ error: 'This license key has been revoked' }, { status: 401 })
  }

  if (licenseKey.redeemed_at) {
    return Response.json({ error: 'This license key has already been used' }, { status: 401 })
  }

  if (licenseKey.expires_at && new Date(licenseKey.expires_at) < new Date()) {
    return Response.json({ error: 'This license key has expired' }, { status: 401 })
  }

  const { data: authData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      customer_id: licenseKey.customer_id,
      role: 'admin',
      full_name: full_name ?? '',
    },
  })

  if (createError || !authData.user) {
    if (createError?.message?.includes('already registered') || createError?.message?.includes('already been registered')) {
      return Response.json({ error: 'An account with this email already exists' }, { status: 409 })
    }
    return Response.json({ error: createError?.message ?? 'Failed to create account' }, { status: 500 })
  }

  await supabase
    .from('license_keys')
    .update({
      redeemed_at: new Date().toISOString(),
      redeemed_by: authData.user.id,
    })
    .eq('id', licenseKey.id)

  return Response.json({ ok: true })
}
