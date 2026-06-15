'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '../ToastContext'

interface Branch {
  id: string
  name: string
  location_note: string | null
  layout: string
  allow_user_rate_edit: boolean
  is_active: boolean
  created_at: string
  branch_token: string
  screens_online: number
  screens_total: number
  configured_screens: number
  templates_used: string[]
}

interface Screen {
  id: string
  name: string
  screen_token: string
  orientation: string
  is_active: boolean
}

interface Props {
  initialBranches: Branch[]
  maxBranches: number
  baseUrl: string
}


export default function BranchList({ initialBranches, maxBranches, baseUrl }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [branches, setBranches] = useState<Branch[]>(initialBranches)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState({ name: '', location_note: '' })

  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [screensMap, setScreensMap] = useState<Record<string, Screen[]>>({})
  const [loadingScreensId, setLoadingScreensId] = useState<string | null>(null)
  const [copiedScreenId, setCopiedScreenId] = useState<string | null>(null)

  const activeBranchCount = branches.filter((b) => b.is_active).length

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error ?? 'Failed to create branch'); return }
      setBranches((prev) => [
        ...prev,
        { ...data, screens_online: 0, screens_total: 0, configured_screens: 0, templates_used: [] },
      ])
      setForm({ name: '', location_note: '' })
      setShowCreate(false)
      router.refresh()
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(branch: Branch) {
    setTogglingId(branch.id)
    const res = await fetch(`/api/branches/${branch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !branch.is_active }),
    })
    if (res.ok) {
      setBranches((prev) =>
        prev.map((b) => (b.id === branch.id ? { ...b, is_active: !branch.is_active } : b))
      )
      toast(branch.is_active ? 'Branch deactivated' : 'Branch activated')
    } else {
      toast('Failed to update branch', 'error')
    }
    setTogglingId(null)
  }

  async function toggleScreens(branchId: string) {
    if (expandedId === branchId) { setExpandedId(null); return }
    setExpandedId(branchId)
    if (!(branchId in screensMap)) {
      setLoadingScreensId(branchId)
      const data = await fetch(`/api/branches/${branchId}/screens`).then((r) => r.json())
      setScreensMap((prev) => ({ ...prev, [branchId]: Array.isArray(data) ? data : [] }))
      setLoadingScreensId(null)
    }
  }

  async function copyUrl(screen: Screen) {
    await navigator.clipboard.writeText(`${baseUrl}/live?token=${screen.screen_token}`)
    setCopiedScreenId(screen.id)
    toast('URL copied to clipboard')
    setTimeout(() => setCopiedScreenId(null), 2000)
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-xl font-semibold text-white">Branches</h1>
          <p className="text-zinc-500 text-xs mt-0.5">
            {activeBranchCount} of {maxBranches} active
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          disabled={activeBranchCount >= maxBranches}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Branch
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
          <h2 className="text-white font-medium text-sm mb-4">New Branch</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Branch Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. City Centre"
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
                required
              />
            </div>
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Location Note</label>
              <input
                type="text"
                value={form.location_note}
                onChange={(e) => setForm((f) => ({ ...f, location_note: e.target.value }))}
                placeholder="e.g. Ground floor"
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          {createError && <p className="text-red-400 text-sm mt-3">{createError}</p>}
          <div className="flex items-center gap-2 mt-4">
            <button
              type="submit"
              disabled={creating || !form.name.trim()}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              {creating ? 'Creating…' : 'Create Branch'}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setCreateError('') }}
              className="text-zinc-400 hover:text-zinc-200 text-sm px-3 py-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Branch cards */}
      {branches.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-zinc-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>
          <p className="text-zinc-400 text-sm font-medium">No branches yet</p>
          <p className="text-zinc-600 text-xs mt-1">Add your first branch to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {branches.map((branch) => {
            const isExpanded = expandedId === branch.id
            const isToggling = togglingId === branch.id
            const screens = screensMap[branch.id]
            const isLoadingScreens = loadingScreensId === branch.id

            return (
              <div
                key={branch.id}
                className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
                  isExpanded
                    ? 'border-purple-600/40 shadow-lg shadow-purple-950/20'
                    : 'border-zinc-800 hover:border-zinc-700'
                } bg-zinc-900`}
              >
                {/* Status stripe */}
                <div
                  className={`h-[3px] transition-all duration-300 ${
                    branch.is_active
                      ? 'bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500'
                      : 'bg-zinc-800'
                  }`}
                />

                {/* Card body */}
                <div className="p-5">

                  {/* Name row */}
                  <div className="flex items-start justify-between gap-3 mb-5">
                    <div className="min-w-0">
                      <h2 className="text-white font-semibold text-[15px] leading-snug truncate">
                        {branch.name}
                      </h2>
                      <p className="text-zinc-500 text-xs mt-0.5 truncate">
                        {branch.location_note ?? 'No location set'}
                      </p>
                    </div>

                    {/* Active toggle */}
                    <button
                      onClick={() => toggleActive(branch)}
                      disabled={isToggling}
                      className={`shrink-0 group flex items-center gap-2 text-xs font-medium pl-2.5 pr-3 py-1.5 rounded-full border transition-all disabled:opacity-50 ${
                        branch.is_active
                          ? 'bg-emerald-950/50 border-emerald-800/50 text-emerald-400 hover:bg-red-950/40 hover:border-red-800/50 hover:text-red-400'
                          : 'bg-zinc-800/80 border-zinc-700 text-zinc-500 hover:bg-emerald-950/40 hover:border-emerald-800/40 hover:text-emerald-400'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full transition-colors ${
                          branch.is_active
                            ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)] group-hover:bg-red-400 group-hover:shadow-none'
                            : 'bg-zinc-600 group-hover:bg-emerald-400'
                        }`}
                      />
                      <span className="group-hover:hidden">{branch.is_active ? 'Active' : 'Inactive'}</span>
                      <span className="hidden group-hover:inline">
                        {branch.is_active ? 'Deactivate' : 'Activate'}
                      </span>
                    </button>
                  </div>

                  {/* Stats chips */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-2.5 py-1.5">
                      <svg className="w-3 h-3 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
                      </svg>
                      <span className="text-zinc-400 text-xs">
                        {branch.configured_screens} {branch.configured_screens === 1 ? 'screen' : 'screens'}
                      </span>
                    </div>

                    {branch.screens_online > 0 && (
                      <div className="flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/40 rounded-lg px-2.5 py-1.5">
                        <span className="relative flex w-2 h-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                          <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-400" />
                        </span>
                        <span className="text-emerald-400 text-xs">{branch.screens_online} online</span>
                      </div>
                    )}

                    {branch.templates_used.map((tpl) => (
                      <div
                        key={tpl}
                        className="flex items-center gap-1 bg-purple-950/40 border border-purple-800/30 rounded-lg px-2.5 py-1.5"
                      >
                        <svg className="w-3 h-3 text-purple-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                        </svg>
                        <span className="text-purple-400 text-xs">{tpl}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer action bar */}
                <div className={`flex items-center gap-2 px-4 py-3 border-t transition-colors ${
                  isExpanded ? 'border-purple-800/20 bg-purple-950/10' : 'border-zinc-800/60 bg-black/20'
                }`}>
                  <button
                    onClick={() => toggleScreens(branch.id)}
                    className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                      isExpanded
                        ? 'bg-purple-600 border-purple-500 text-white shadow-sm shadow-purple-900/40'
                        : 'bg-zinc-800/70 border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                    }`}
                  >
                    <svg
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                    Screen URLs
                    {branch.configured_screens > 0 && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                        isExpanded ? 'bg-purple-500/50 text-purple-100' : 'bg-zinc-700 text-zinc-400'
                      }`}>
                        {branch.configured_screens}
                      </span>
                    )}
                  </button>

                  <div className="flex-1" />

                  <Link
                    href={`/admin/branches/${branch.id}`}
                    className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors group"
                  >
                    Settings
                    <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                </div>

                {/* Screen URLs panel */}
                {isExpanded && (
                  <div className="border-t border-purple-800/15">
                    {isLoadingScreens ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-zinc-600 text-xs">
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Loading screens…
                      </div>
                    ) : !screens || screens.length === 0 ? (
                      <div className="py-8 px-5 text-center">
                        <p className="text-zinc-600 text-xs">No screens configured yet.</p>
                        <Link
                          href={`/admin/branches/${branch.id}`}
                          className="text-purple-400 hover:text-purple-300 text-xs mt-1.5 inline-flex items-center gap-1"
                        >
                          Add screens in Settings
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </Link>
                      </div>
                    ) : (
                      <div>
                        {screens.map((screen, idx) => {
                          const isCopied = copiedScreenId === screen.id
                          const isPortrait = screen.orientation === 'portrait'
                          return (
                            <div
                              key={screen.id}
                              className={`flex items-center gap-3 px-5 py-3.5 ${
                                idx < screens.length - 1 ? 'border-b border-zinc-800/40' : ''
                              }`}
                            >
                              <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/50 flex items-center justify-center shrink-0">
                                {isPortrait ? (
                                  <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <rect x="6" y="2" width="12" height="20" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <rect x="2" y="6" width="20" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="text-zinc-200 text-xs font-medium truncate">{screen.name}</p>
                                <p className="text-zinc-600 text-[10px] mt-0.5">
                                  {isPortrait ? 'Portrait' : 'Landscape'}
                                </p>
                              </div>

                              <button
                                onClick={() => copyUrl(screen)}
                                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all shrink-0 ${
                                  isCopied
                                    ? 'bg-emerald-950/50 border-emerald-700/50 text-emerald-400 scale-95'
                                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-purple-600/60 hover:text-purple-300 hover:bg-purple-950/20'
                                }`}
                              >
                                {isCopied ? (
                                  <>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                                    </svg>
                                    Copy URL
                                  </>
                                )}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
