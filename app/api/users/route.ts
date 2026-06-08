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

  const { data: users, error } = await supabase
    .from('users')
    .select(`
      id, full_name, email, role, is_active, created_at,
      branch_user_assignments (
        branch_id,
        branches ( id, name )
      )
    `)
    .eq('customer_id', auth.customer_id)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(users ?? [])
}

export async function POST(request: NextRequest) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const { email, password, full_name, branch_id } = body ?? {}

  if (!email?.trim()) return Response.json({ error: 'Email is required' }, { status: 400 })
  if (!password || password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // If branch_id provided, verify it belongs to this customer
  if (branch_id) {
    const { data: branch } = await supabase
      .from('branches')
      .select('id')
      .eq('id', branch_id)
      .eq('customer_id', auth.customer_id)
      .single()
    if (!branch) return Response.json({ error: 'Branch not found' }, { status: 404 })
  }

  const { data: authData, error: createError } = await supabase.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: {
      customer_id: auth.customer_id,
      role: 'branch_user',
      full_name: full_name?.trim() ?? '',
    },
  })

  if (createError || !authData.user) {
    if (createError?.message?.includes('already registered') || createError?.message?.includes('already been registered')) {
      return Response.json({ error: 'An account with this email already exists' }, { status: 409 })
    }
    return Response.json({ error: createError?.message ?? 'Failed to create user' }, { status: 500 })
  }

  // Assign to branch if provided
  if (branch_id) {
    await supabase.from('branch_user_assignments').insert({
      user_id: authData.user.id,
      branch_id,
    })
  }

  return Response.json({ ok: true, user_id: authData.user.id }, { status: 201 })
}
