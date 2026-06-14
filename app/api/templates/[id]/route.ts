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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

  const supabase = createAdminClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) update.name = String(body.name).trim()
  if (body.columns !== undefined) update.columns = body.columns

  const { data, error } = await supabase
    .from('display_templates')
    .update(update)
    .eq('id', id)
    .eq('customer_id', auth.customer_id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: 'Not found' }, { status: 404 })
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

  const { data: tmpl } = await supabase
    .from('display_templates')
    .select('is_default')
    .eq('id', id)
    .eq('customer_id', auth.customer_id)
    .single()

  if (!tmpl) return Response.json({ error: 'Not found' }, { status: 404 })
  if (tmpl.is_default) return Response.json({ error: 'Cannot delete the default template' }, { status: 400 })

  const { error } = await supabase
    .from('display_templates')
    .delete()
    .eq('id', id)
    .eq('customer_id', auth.customer_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
