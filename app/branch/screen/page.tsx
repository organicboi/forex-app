import { requireBranchUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function BranchScreenPage() {
  const user = await requireBranchUser()
  const supabase = createAdminClient()

  const { data: assignment } = await supabase
    .from('branch_user_assignments')
    .select('branch_id')
    .eq('user_id', user.id)
    .single()

  if (!assignment) return null

  const { data: sessions } = await supabase
    .from('screen_sessions')
    .select('id, session_key, last_seen_at, user_agent, ip_address')
    .eq('branch_id', assignment.branch_id)
    .order('last_seen_at', { ascending: false })

  const now = new Date()
  const ONLINE_THRESHOLD_MS = 90 * 1000

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Screen Status</h1>
        <p className="text-zinc-500 text-sm mt-1">
          TV screens at your branch. A screen is online if it checked in within the last 90 seconds.
        </p>
      </div>

      {!sessions || sessions.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No TV screens have connected yet.</p>
          <p className="text-zinc-600 text-xs mt-2">
            Open the TV URL on a screen to register it.
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Session</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Last Seen</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const lastSeen = new Date(s.last_seen_at)
                const isOnline = now.getTime() - lastSeen.getTime() < ONLINE_THRESHOLD_MS
                const minutesAgo = Math.floor((now.getTime() - lastSeen.getTime()) / 60000)

                return (
                  <tr key={s.id} className="border-b border-zinc-800/50 last:border-0">
                    <td className="px-4 py-3">
                      <code className="text-zinc-400 text-xs font-mono">{s.session_key.slice(0, 12)}…</code>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                          isOnline
                            ? 'bg-green-900/40 text-green-400'
                            : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-zinc-500'}`} />
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {isOnline
                        ? 'Just now'
                        : minutesAgo < 60
                          ? `${minutesAgo}m ago`
                          : lastSeen.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs font-mono">
                      {s.ip_address ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
