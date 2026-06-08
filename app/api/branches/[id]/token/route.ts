import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

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

export async function POST(
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

  const newToken = crypto.randomBytes(32).toString('hex')

  const { data, error } = await supabase
    .from('branches')
    .update({ branch_token: newToken })
    .eq('id', id)
    .select('branch_token')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ branch_token: data.branch_token })
}
