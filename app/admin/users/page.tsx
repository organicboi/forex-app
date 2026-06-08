import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import UserManager from './UserManager'

export default async function UsersPage() {
  const user = await requireAdmin()
  const supabase = createAdminClient()

  const [{ data: users }, { data: branches }] = await Promise.all([
    supabase
      .from('users')
      .select(`
        id, full_name, email, role, is_active, created_at,
        branch_user_assignments (
          branch_id,
          branches ( id, name )
        )
      `)
      .eq('customer_id', user.customer_id)
      .order('created_at', { ascending: true }),
    supabase
      .from('branches')
      .select('id, name')
      .eq('customer_id', user.customer_id)
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ])

  return (
    <UserManager
      initialUsers={(users ?? []) as unknown as Parameters<typeof UserManager>[0]['initialUsers']}
      branches={branches ?? []}
      currentUserId={user.id}
    />
  )
}
