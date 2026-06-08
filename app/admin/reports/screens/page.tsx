import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const ONLINE_THRESHOLD_MS = 90 * 1000

export default async function ScreensReportPage() {
  const user = await requireAdmin()
  const supabase = createAdminClient()

  const [{ data: branchStatus }, { data: branchRows }, { data: sessions }] = await Promise.all([
    supabase
      .from('v_branch_screen_status')
      .select('branch_id, branch_name, screens_online, screens_total, last_seen_at')
      .eq('customer_id', user.customer_id)
      .order('branch_name', { ascending: true }),
    supabase
      .from('branches')
      .select('id, name')
      .eq('customer_id', user.customer_id)
      .order('name', { ascending: true }),
    supabase
      .from('screen_sessions')
      .select('id, branch_id, session_key, last_seen_at, user_agent, ip_address')
      .in(
        'branch_id',
        (await supabase.from('branches').select('id').eq('customer_id', user.customer_id)).data?.map((b) => b.id) ?? []
      )
      .order('last_seen_at', { ascending: false })
      .limit(200),
  ])

  const now = Date.now()
  const branchNameMap = Object.fromEntries((branchRows ?? []).map((b) => [b.id, b.name]))
  const sessionsByBranch = (sessions ?? []).reduce<Record<string, typeof sessions>>((acc, s) => {
    if (!s) return acc
    const arr = acc[s.branch_id] ?? []
    arr.push(s)
    acc[s.branch_id] = arr
    return acc
  }, {})

  const statusMap = Object.fromEntries((branchStatus ?? []).map((b) => [b.branch_id, b]))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Screen Uptime</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Online status and session history for every TV screen across your branches. A screen is online if it checked in within the last 90 seconds.
        </p>
      </div>

      {/* Summary cards */}
      {branchStatus && branchStatus.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {branchStatus.map((b) => (
            <div key={b.branch_id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="text-zinc-400 text-xs font-medium mb-2 truncate">{b.branch_name}</div>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${b.screens_online > 0 ? 'text-green-400' : 'text-zinc-600'}`}>
                  {b.screens_online}
                </span>
                <span className="text-zinc-600 text-sm">/ {b.screens_total} online</span>
              </div>
              {b.last_seen_at && (
                <div className="text-zinc-600 text-xs mt-1">
                  Last: {new Date(b.last_seen_at).toLocaleTimeString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Per-branch session tables */}
      {(branchRows ?? []).length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No branches yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {(branchRows ?? []).map((branch) => {
            const branchSessions = sessionsByBranch[branch.id] ?? []
            const status = statusMap[branch.id]
            return (
              <div key={branch.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                  <h2 className="text-white text-sm font-medium">{branch.name}</h2>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      (status?.screens_online ?? 0) > 0 ? 'bg-green-400' : 'bg-zinc-600'
                    }`} />
                    <span className="text-zinc-500 text-xs">
                      {status?.screens_online ?? 0} / {status?.screens_total ?? 0} online
                    </span>
                  </div>
                </div>

                {branchSessions.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-zinc-600 text-sm">No screens have connected yet.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800/60">
                        <th className="text-left px-4 py-2 text-zinc-500 text-xs font-medium">Session</th>
                        <th className="text-left px-4 py-2 text-zinc-500 text-xs font-medium">Status</th>
                        <th className="text-left px-4 py-2 text-zinc-500 text-xs font-medium">Last Seen</th>
                        <th className="text-left px-4 py-2 text-zinc-500 text-xs font-medium">IP</th>
                        <th className="text-left px-4 py-2 text-zinc-500 text-xs font-medium">User Agent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branchSessions.map((s) => {
                        if (!s) return null
                        const lastSeen = new Date(s.last_seen_at)
                        const isOnline = now - lastSeen.getTime() < ONLINE_THRESHOLD_MS
                        const minsAgo = Math.floor((now - lastSeen.getTime()) / 60000)
                        return (
                          <tr key={s.id} className="border-b border-zinc-800/30 last:border-0">
                            <td className="px-4 py-2">
                              <code className="text-zinc-400 text-xs font-mono">{s.session_key.slice(0, 12)}…</code>
                            </td>
                            <td className="px-4 py-2">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                                isOnline ? 'bg-green-900/40 text-green-400' : 'bg-zinc-800 text-zinc-500'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-zinc-500'}`} />
                                {isOnline ? 'Online' : 'Offline'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-zinc-400 text-xs">
                              {isOnline ? 'Just now' : minsAgo < 60 ? `${minsAgo}m ago` : lastSeen.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-zinc-600 text-xs font-mono">{s.ip_address ?? '—'}</td>
                            <td className="px-4 py-2 text-zinc-700 text-xs truncate max-w-[200px]" title={s.user_agent ?? ''}>
                              {s.user_agent ? s.user_agent.slice(0, 60) + (s.user_agent.length > 60 ? '…' : '') : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
