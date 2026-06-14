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

const DEFAULT_COLUMNS = [
  { key: 'buy',      label: 'Buy',      color: '#16a34a', visible: true, order: 0, is_builtin: true },
  { key: 'sell',     label: 'Sell',     color: '#dc2626', visible: true, order: 1, is_builtin: true },
  { key: 'transfer', label: 'Transfer', color: '#7c3aed', visible: true, order: 2, is_builtin: true },
]

export async function GET() {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('display_templates')
    .select('*')
    .eq('customer_id', auth.customer_id)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.name?.trim()) return Response.json({ error: 'name is required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('display_templates')
    .insert({
      customer_id: auth.customer_id,
      name: String(body.name).trim(),
      is_default: false,
      columns: Array.isArray(body.columns) ? body.columns : DEFAULT_COLUMNS,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
