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

  const [{ data: branchStatus }, { data: sessions }] = await Promise.all([
    supabase
      .from('v_branch_screen_status')
      .select('branch_id, branch_name, screens_online, screens_total, last_seen_at')
      .eq('customer_id', auth.customer_id)
      .order('branch_name', { ascending: true }),
    supabase
      .from('screen_sessions')
      .select('id, branch_id, session_key, last_seen_at, user_agent, ip_address')
      .in(
        'branch_id',
        (
          await supabase
            .from('branches')
            .select('id')
            .eq('customer_id', auth.customer_id)
        ).data?.map((b) => b.id) ?? []
      )
      .order('last_seen_at', { ascending: false }),
  ])

  return Response.json({ branchStatus: branchStatus ?? [], sessions: sessions ?? [] })
}
