import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

export default async function StorageReportPage() {
  const user = await requireAdmin()
  const supabase = createAdminClient()

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

  const barColor =
    usedPercent >= 90 ? 'bg-red-500' :
    usedPercent >= 70 ? 'bg-yellow-500' :
    'bg-purple-500'

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Storage Usage</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Ad file storage used vs your plan limit.
        </p>
      </div>

      {/* Storage bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-white text-lg font-semibold">
            {usedMb.toFixed(1)} MB <span className="text-zinc-500 text-sm font-normal">used</span>
          </span>
          <span className="text-zinc-500 text-sm">
            {limitMb} MB limit
          </span>
        </div>
        <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} rounded-full transition-all`}
            style={{ width: `${usedPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-zinc-600 text-xs">{usedPercent.toFixed(1)}% used</span>
          <span className="text-zinc-600 text-xs">
            {(limitMb - usedMb).toFixed(1)} MB free
          </span>
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

      {/* Per-file breakdown */}
      {adList.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No ad files uploaded yet.</p>
          <p className="text-zinc-600 text-xs mt-2">
            Go to <a href="/admin/ads" className="text-purple-400 hover:underline">Ads</a> to upload files.
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
                const pct = usedMb > 0
                  ? ((ad.file_size_bytes ?? 0) / (usedMb * 1048576)) * 100
                  : 0
                return (
                  <tr key={ad.id} className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/20">
                    <td className="px-4 py-2">
                      <div className="text-zinc-300 text-xs truncate max-w-50" title={ad.original_name ?? ''}>
                        {ad.original_name ?? 'Unnamed'}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        ad.file_type === 'video'
                          ? 'bg-blue-900/40 text-blue-400'
                          : 'bg-purple-900/40 text-purple-400'
                      }`}>
                        {ad.file_type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-zinc-500 text-xs">
                      {ad.branch_id ? 'Branch' : 'Customer-wide'}
                    </td>
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
                          <div
                            className="h-full bg-purple-500 rounded-full"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
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
    </div>
  )
}
