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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: branch_id } = await params
  const supabase = createAdminClient()

  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('id', branch_id)
    .eq('customer_id', auth.customer_id)
    .single()

  if (!branch) return Response.json({ error: 'Branch not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('screens')
    .select('id, name, screen_token, template_id, orientation, layout, is_active, created_at, display_templates(id, name)')
    .eq('branch_id', branch_id)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data ?? [])
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: branch_id } = await params
  const supabase = createAdminClient()

  const { data: branch } = await supabase
    .from('branches')
    .select('id, customer_id')
    .eq('id', branch_id)
    .eq('customer_id', auth.customer_id)
    .single()

  if (!branch) return Response.json({ error: 'Branch not found' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const { name, template_id = null } = body ?? {}

  if (!name?.trim()) return Response.json({ error: 'Screen name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('screens')
    .insert({
      branch_id,
      customer_id: branch.customer_id,
      name: name.trim(),
      template_id: template_id || null,
    })
    .select('id, name, screen_token, template_id, orientation, layout, is_active, created_at, display_templates(id, name)')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data, { status: 201 })
}
