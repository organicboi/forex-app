import { requireBranchUser } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import Image from 'next/image'

export default async function BranchAdsPage() {
  const user = await requireBranchUser()
  const supabase = createAdminClient()

  const { data: assignment } = await supabase
    .from('branch_user_assignments')
    .select('branch_id, branches(customer_id)')
    .eq('user_id', user.id)
    .single()

  if (!assignment) return null

  const branchRaw = Array.isArray(assignment.branches) ? assignment.branches[0] : assignment.branches
  const customerId = branchRaw?.customer_id ?? user.customer_id
  const branchId = assignment.branch_id

  // Fetch both customer-wide and branch-specific ads
  const [{ data: customerAds }, { data: branchAds }] = await Promise.all([
    supabase
      .from('ads')
      .select('id, file_url, file_type, duration_seconds, is_active, original_name, file_size_bytes')
      .eq('customer_id', customerId)
      .is('branch_id', null)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabase
      .from('ads')
      .select('id, file_url, file_type, duration_seconds, is_active, original_name, file_size_bytes')
      .eq('customer_id', customerId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
  ])

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const AdRow = ({ ad }: { ad: typeof customerAds extends Array<infer T> | null ? T : never }) => (
    <tr className="border-b border-zinc-800/50 last:border-0">
      <td className="px-4 py-3">
        {ad.file_type === 'image' ? (
          <div className="w-12 h-8 bg-zinc-800 rounded overflow-hidden">
            <Image
              src={ad.file_url}
              alt={ad.original_name ?? 'Ad'}
              width={48}
              height={32}
              unoptimized
              className="object-cover w-full h-full"
            />
          </div>
        ) : (
          <div className="w-12 h-8 bg-zinc-800 rounded flex items-center justify-center">
            <span className="text-zinc-500 text-xs">▶</span>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="text-zinc-300 text-xs">{ad.original_name ?? '—'}</div>
        <div className="text-zinc-600 text-xs capitalize mt-0.5">{ad.file_type}</div>
      </td>
      <td className="px-4 py-3 text-right text-zinc-400 text-xs">{ad.duration_seconds}s</td>
      <td className="px-4 py-3 text-right text-zinc-500 text-xs">{formatBytes(ad.file_size_bytes)}</td>
    </tr>
  )

  const AdTable = ({ title, ads }: { title: string; ads: typeof customerAds }) => (
    <div className="mb-6">
      <h2 className="text-zinc-400 text-sm font-medium mb-3">{title}</h2>
      {!ads || ads.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-600 text-sm">No active ads in this group.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-zinc-500 font-medium w-16">Preview</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">File</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium w-20">Duration</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium w-20">Size</th>
              </tr>
            </thead>
            <tbody>
              {ads.map((ad) => <AdRow key={ad.id} ad={ad} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Ads</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Active ads shown on this branch&apos;s TV screens. To manage ads, contact your admin.
        </p>
      </div>
      <AdTable title="Customer-wide Ads" ads={customerAds} />
      <AdTable title="Branch-specific Ads" ads={branchAds} />
    </div>
  )
}
