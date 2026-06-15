import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import RateHistoryReport from './rates/RateHistoryReport'
import AdminTabBar from '../AdminTabBar'

const TABS = [
  { key: 'history', label: 'Rate History' },
  { key: 'screens', label: 'Screen Uptime' },
  { key: 'storage', label: 'Storage' },
]

const ONLINE_THRESHOLD_MS = 90 * 1000

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await requireAdmin()
  const supabase = createAdminClient()
  const { tab } = await searchParams
  const activeTab = TABS.some((t) => t.key === tab) ? (tab as string) : 'history'

  const titles: Record<string, { title: string; desc: string }> = {
    history: {
      title: 'Rate History',
      desc: 'Audit log of every rate change. Default shows last 7 days — use filters to narrow down.',
    },
    screens: {
      title: 'Screen Uptime',
      desc: 'Online status and session history for every TV screen across your branches. A screen is online if it checked in within the last 90 seconds.',
    },
    storage: {
      title: 'Storage',
      desc: 'Ad file storage used vs your plan limit.',
    },
  }

  const { title, desc } = titles[activeTab]
  let content: React.ReactNode = null

  if (activeTab === 'history') {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [{ data: history }, { data: currencies }, { data: branches }, { data: users }] = await Promise.all([
      supabase
        .from('rate_history')
        .select('id, currency_id, branch_id, changed_by, source, buy, sell, transfer, changed_at')
        .eq('customer_id', user.customer_id)
        .gte('changed_at', sevenDaysAgo)
        .order('changed_at', { ascending: false })
        .limit(500),
      supabase.from('currencies').select('id, code'),
      supabase
        .from('branches')
        .select('id, name')
        .eq('customer_id', user.customer_id)
        .order('name', { ascending: true }),
      supabase
        .from('users')
        .select('id, full_name')
        .eq('customer_id', user.customer_id),
    ])

    const currencyMap = Object.fromEntries((currencies ?? []).map((c) => [c.id, c.code]))
    const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u.full_name]))
    const branchMap = Object.fromEntries((branches ?? []).map((b) => [b.id, b.name]))

    const rows = (history ?? []).map((h) => ({
      id: h.id,
      changed_at: h.changed_at,
      currency_code: currencyMap[h.currency_id] ?? h.currency_id,
      buy: h.buy,
      sell: h.sell,
      transfer: h.transfer,
      source: h.source,
      changed_by_name: h.changed_by ? (userMap[h.changed_by] ?? 'Unknown') : 'System',
      branch_name: h.branch_id ? (branchMap[h.branch_id] ?? 'Unknown') : null,
    }))

    content = (
      <RateHistoryReport
        initialRows={rows}
        currencies={currencies ?? []}
        branches={branches ?? []}
      />
    )
  } else if (activeTab === 'screens') {
    const { data: customerBranches } = await supabase
      .from('branches')
      .select('id')
      .eq('customer_id', user.customer_id)

    const branchIds = (customerBranches ?? []).map((b) => b.id)

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
        .in('branch_id', branchIds.length > 0 ? branchIds : ['00000000-0000-0000-0000-000000000000'])
        .order('last_seen_at', { ascending: false })
        .limit(200),
    ])

    const now = Date.now()
    const statusMap = Object.fromEntries((branchStatus ?? []).map((b) => [b.branch_id, b]))
    const sessionsByBranch = (sessions ?? []).reduce<Record<string, typeof sessions>>((acc, s) => {
      if (!s) return acc
      const arr = acc[s.branch_id] ?? []
      arr.push(s)
      acc[s.branch_id] = arr
      return acc
    }, {})

    content = (
      <>
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
                      <span className={`w-2 h-2 rounded-full ${(status?.screens_online ?? 0) > 0 ? 'bg-green-400' : 'bg-zinc-600'}`} />
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
                                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${isOnline ? 'bg-green-900/40 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
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
      </>
    )
  } else if (activeTab === 'storage') {
    const [{ data: storageRow }, { data: ads }] = await Promise.all([
      supabase
        .from('v_customer_storage')
        .select('used_mb, limit_mb, used_percent')
        .eq('customer_id', user.customer_id)
        .single(),
      supabase
        .from('ads')
        .select('id, original_name, file_type, file_url, file_size_bytes, is_active, branch_id, created_at')
        .eq('customer_id', user.customer_id)
        .order('file_size_bytes', { ascending: false }),
    ])

    const usedMb = Number(storageRow?.used_mb ?? 0)
    const limitMb = Number(storageRow?.limit_mb ?? 500)
    const usedPercent = limitMb > 0 ? Math.min(100, (usedMb / limitMb) * 100) : 0
    const adList = ads ?? []
    const barColor = usedPercent >= 90 ? 'bg-red-500' : usedPercent >= 70 ? 'bg-yellow-500' : 'bg-purple-500'

    content = (
      <>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-white text-lg font-semibold">
              {usedMb.toFixed(1)} MB <span className="text-zinc-500 text-sm font-normal">used</span>
            </span>
            <span className="text-zinc-500 text-sm">{limitMb} MB limit</span>
          </div>
          <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${usedPercent}%` }} />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-zinc-600 text-xs">{usedPercent.toFixed(1)}% used</span>
            <span className="text-zinc-600 text-xs">{(limitMb - usedMb).toFixed(1)} MB free</span>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-zinc-800">
            <div>
              <div className="text-zinc-500 text-xs mb-1">Total files</div>
              <div className="text-white text-xl font-semibold">{adList.length}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs mb-1">Active files</div>
              <div className="text-white text-xl font-semibold">{adList.filter((a) => a.is_active).length}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs mb-1">Avg. file size</div>
              <div className="text-white text-xl font-semibold">
                {adList.length > 0
                  ? formatBytes(Math.round(adList.reduce((s, a) => s + (a.file_size_bytes ?? 0), 0) / adList.length))
                  : '—'}
              </div>
            </div>
          </div>
        </div>

        {adList.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
            <p className="text-zinc-500 text-sm">No ad files uploaded yet.</p>
            <p className="text-zinc-600 text-xs mt-2">
              Go to{' '}
              <a href="/admin/display" className="text-purple-400 hover:underline">Display → Ads</a>{' '}
              to upload files.
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-zinc-300 text-sm font-medium">Files</h2>
              <span className="text-zinc-600 text-xs">Sorted by size (largest first)</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-2 text-zinc-500 text-xs font-medium">File</th>
                  <th className="text-left px-4 py-2 text-zinc-500 text-xs font-medium">Type</th>
                  <th className="text-left px-4 py-2 text-zinc-500 text-xs font-medium">Scope</th>
                  <th className="text-left px-4 py-2 text-zinc-500 text-xs font-medium">Status</th>
                  <th className="text-right px-4 py-2 text-zinc-500 text-xs font-medium">Size</th>
                  <th className="text-right px-4 py-2 text-zinc-500 text-xs font-medium">% of total</th>
                </tr>
              </thead>
              <tbody>
                {adList.map((ad) => {
                  const pct = usedMb > 0 ? ((ad.file_size_bytes ?? 0) / (usedMb * 1048576)) * 100 : 0
                  return (
                    <tr key={ad.id} className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/20">
                      <td className="px-4 py-2">
                        <div className="text-zinc-300 text-xs truncate max-w-[200px]" title={ad.original_name ?? ''}>
                          {ad.original_name ?? 'Unnamed'}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ad.file_type === 'video' ? 'bg-blue-900/40 text-blue-400' : 'bg-purple-900/40 text-purple-400'}`}>
                          {ad.file_type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-zinc-500 text-xs">{ad.branch_id ? 'Branch' : 'Customer-wide'}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs ${ad.is_active ? 'text-green-400' : 'text-zinc-600'}`}>
                          {ad.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-zinc-300 text-xs font-mono">
                        {formatBytes(ad.file_size_bytes ?? 0)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                          <span className="text-zinc-500 text-xs w-10 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <p className="text-zinc-500 text-sm mt-1">{desc}</p>
      </div>

      <AdminTabBar tabs={TABS} activeTab={activeTab} basePath="/admin/reports" />

      {content}
    </div>
  )
}
