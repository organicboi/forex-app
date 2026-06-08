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

  if (id === auth.user_id) {
    return Response.json({ error: 'Cannot modify your own account here' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const { is_active, branch_id } = body ?? {}

  const supabase = createAdminClient()

  // Verify ownership
  const { data: target } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', id)
    .eq('customer_id', auth.customer_id)
    .single()

  if (!target) return Response.json({ error: 'User not found' }, { status: 404 })

  const ops: PromiseLike<unknown>[] = []

  if (is_active !== undefined) {
    ops.push(
      supabase
        .from('users')
        .update({ is_active: Boolean(is_active) })
        .eq('id', id)
    )
  }

  // Update branch assignment (branch_user only)
  if (branch_id !== undefined && target.role === 'branch_user') {
    if (branch_id === null) {
      ops.push(
        supabase.from('branch_user_assignments').delete().eq('user_id', id)
      )
    } else {
      // Verify branch belongs to this customer
      const { data: branch } = await supabase
        .from('branches')
        .select('id')
        .eq('id', branch_id)
        .eq('customer_id', auth.customer_id)
        .single()
      if (!branch) return Response.json({ error: 'Branch not found' }, { status: 404 })

      ops.push(
        supabase
          .from('branch_user_assignments')
          .upsert({ user_id: id, branch_id }, { onConflict: 'user_id' })
      )
    }
  }

  await Promise.all(ops)

  return Response.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  if (id === auth.user_id) {
    return Response.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify ownership
  const { data: target } = await supabase
    .from('users')
    .select('id')
    .eq('id', id)
    .eq('customer_id', auth.customer_id)
    .single()

  if (!target) return Response.json({ error: 'User not found' }, { status: 404 })

  // Delete from auth.users — cascades to public.users and branch_user_assignments
  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
