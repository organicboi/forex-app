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

const VALID_LAYOUTS = ['split-standard', 'rates-full', 'ads-full', 'portrait', 'rates-wide']

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('branches')
    .select('id, name, location_note, layout, allow_user_rate_edit, is_active, created_at, branch_token')
    .eq('id', id)
    .eq('customer_id', auth.customer_id)
    .single()

  if (error || !data) return Response.json({ error: 'Branch not found' }, { status: 404 })

  return Response.json(data)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)

  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

  const { name, location_note, layout, allow_user_rate_edit, is_active } = body
  const updates: Partial<{ name: string; location_note: string | null; layout: 'split-standard' | 'rates-full' | 'ads-full' | 'portrait' | 'rates-wide'; allow_user_rate_edit: boolean; is_active: boolean }> = {}

  if (name !== undefined) {
    if (!name.trim()) return Response.json({ error: 'Branch name cannot be empty' }, { status: 400 })
    updates.name = name.trim()
  }
  if (location_note !== undefined) updates.location_note = location_note?.trim() || null
  if (layout !== undefined) {
    if (!VALID_LAYOUTS.includes(layout)) {
      return Response.json({ error: 'Invalid layout value' }, { status: 400 })
    }
    updates.layout = layout
  }
  if (allow_user_rate_edit !== undefined) updates.allow_user_rate_edit = Boolean(allow_user_rate_edit)
  if (is_active !== undefined) updates.is_active = Boolean(is_active)

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Ownership check
  const { data: existing } = await supabase
    .from('branches')
    .select('id')
    .eq('id', id)
    .eq('customer_id', auth.customer_id)
    .single()

  if (!existing) return Response.json({ error: 'Branch not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('branches')
    .update(updates)
    .eq('id', id)
    .select('id, name, location_note, layout, allow_user_rate_edit, is_active')
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

  // Ownership check
  const { data: existing } = await supabase
    .from('branches')
    .select('id')
    .eq('id', id)
    .eq('customer_id', auth.customer_id)
    .single()

  if (!existing) return Response.json({ error: 'Branch not found' }, { status: 404 })

  const { error } = await supabase.from('branches').delete().eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
