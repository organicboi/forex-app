import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database.types'

type ScreenUpdate = Database['public']['Tables']['screens']['Update']

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('screens')
    .select('id')
    .eq('id', id)
    .eq('customer_id', auth.customer_id)
    .single()

  if (!existing) return Response.json({ error: 'Screen not found' }, { status: 404 })

  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

  const updates: ScreenUpdate = {}
  if (body.name !== undefined) {
    if (!body.name?.trim()) return Response.json({ error: 'Name cannot be empty' }, { status: 400 })
    updates.name = body.name.trim()
  }
  if ('template_id' in body) updates.template_id = body.template_id || null
  if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active)
  if (body.orientation !== undefined) {
    if (!['landscape', 'portrait'].includes(body.orientation)) {
      return Response.json({ error: 'Invalid orientation' }, { status: 400 })
    }
    updates.orientation = body.orientation
  }

  if (Object.keys(updates).length === 0) return Response.json({ error: 'Nothing to update' }, { status: 400 })

  const { data, error } = await supabase
    .from('screens')
    .update(updates)
    .eq('id', id)
    .select('id, name, screen_token, template_id, orientation, is_active, display_templates(id, name)')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('screens')
    .select('id, branch_id')
    .eq('id', id)
    .eq('customer_id', auth.customer_id)
    .single()

  if (!existing) return Response.json({ error: 'Screen not found' }, { status: 404 })

  const { count } = await supabase
    .from('screens')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', existing.branch_id)

  if ((count ?? 0) <= 1) {
    return Response.json({ error: 'Cannot delete the only screen on a branch' }, { status: 400 })
  }

  const { error } = await supabase.from('screens').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
