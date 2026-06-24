'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/app/admin/ToastContext'

interface Branch {
  id: string
  name: string
  location_note: string | null
  layout: string
  allow_user_rate_edit: boolean
  is_active: boolean
  branch_token: string
}

interface Template {
  id: string
  name: string
  is_default: boolean
}

interface Screen {
  id: string
  name: string
  screen_token: string
  template_id: string | null
  orientation: string
  layout: string
  rates_per_page: number | null
  is_active: boolean
  created_at: string
  display_templates: { id: string; name: string } | null
}

interface AdItem {
  id: string
  original_name: string | null
  file_type: 'image' | 'video'
  file_url: string
  duration_seconds: number
  is_active: boolean
}

interface Props {
  branch: Branch
  baseUrl: string
}

const LAYOUT_OPTIONS = [
  { value: 'split-standard', label: 'Standard Split — 64% rates / 36% ads (default)' },
  { value: 'rates-wide',     label: 'Wide Rates — 75% rates / 25% ads' },
  { value: 'rates-full',     label: 'Rates Only — full screen, no ads' },
  { value: 'ads-full',       label: 'Ads Only — full screen, no rates' },
  { value: 'portrait',       label: 'Stacked — rates top / ads bottom' },
]

export default function BranchDetail({ branch, baseUrl }: Props) {
  const router = useRouter()
  const { toast } = useToast()

  // ── Branch settings ────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name: branch.name,
    location_note: branch.location_note ?? '',
    allow_user_rate_edit: branch.allow_user_rate_edit,
    is_active: branch.is_active,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  // ── Screens ────────────────────────────────────────────────────────────────
  const [screens, setScreens] = useState<Screen[]>([])
  const [screensLoading, setScreensLoading] = useState(true)
  const [templates, setTemplates] = useState<Template[]>([])
  const [allAds, setAllAds] = useState<AdItem[]>([])

  const [addingScreen, setAddingScreen] = useState(false)
  const [newScreenName, setNewScreenName] = useState('')
  const [newScreenTemplate, setNewScreenTemplate] = useState('')
  const [creatingScreen, setCreatingScreen] = useState(false)
  const [createScreenError, setCreateScreenError] = useState('')

  const [copied, setCopied] = useState<string | null>(null)
  const [deletingScreen, setDeletingScreen] = useState<string | null>(null)
  const [confirmDeleteScreen, setConfirmDeleteScreen] = useState<string | null>(null)
  const [regenning, setRegenning] = useState<string | null>(null)
  const [screenError, setScreenError] = useState('')

  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editingNameValue, setEditingNameValue] = useState('')
  const editNameRef = useRef<HTMLInputElement>(null)

  // ── Per-screen expanded settings panel (orientation + ads) ─────────────────
  const [expandedScreenId, setExpandedScreenId] = useState<string | null>(null)
  const [screenAdIds, setScreenAdIds] = useState<Record<string, string[]>>({})
  const [loadingScreenAds, setLoadingScreenAds] = useState<string | null>(null)

  // ── Currencies-per-page draft values (uncommitted input) ──────────────────
  const [rppDraft, setRppDraft] = useState<Record<string, string>>({})

  // ── Branch delete ──────────────────────────────────────────────────────────
  const [deleting, setDeleting] = useState(false)
  const [confirmBranchDelete, setConfirmBranchDelete] = useState(false)

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch(`/api/branches/${branch.id}/screens`).then((r) => r.json()),
      fetch('/api/templates').then((r) => r.json()),
      fetch('/api/ads?all=true').then((r) => r.json()),
    ]).then(([screensData, templatesData, adsData]) => {
      setScreens(Array.isArray(screensData) ? screensData : [])
      setTemplates(Array.isArray(templatesData) ? templatesData : [])
      setAllAds(Array.isArray(adsData) ? adsData.filter((a: AdItem) => a.is_active) : [])
      setScreensLoading(false)
    })
  }, [branch.id])

  useEffect(() => {
    if (editingNameId && editNameRef.current) {
      editNameRef.current.focus()
      editNameRef.current.select()
    }
  }, [editingNameId])

  // ── Branch settings handlers ───────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    setSaved(false)
    try {
      const res = await fetch(`/api/branches/${branch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error ?? 'Failed to save'); return }
      setSaved(true)
      toast('Branch settings saved')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteBranch() {
    if (!confirmBranchDelete) { setConfirmBranchDelete(true); return }
    setDeleting(true)
    try {
      const res = await fetch(`/api/branches/${branch.id}`, { method: 'DELETE' })
      if (res.ok) { router.push('/admin/branches'); router.refresh() }
    } finally {
      setDeleting(false)
    }
  }

  // ── Screen handlers ────────────────────────────────────────────────────────
  async function handleCreateScreen(e: React.FormEvent) {
    e.preventDefault()
    if (!newScreenName.trim()) return
    setCreatingScreen(true)
    setCreateScreenError('')
    try {
      const res = await fetch(`/api/branches/${branch.id}/screens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newScreenName.trim(),
          template_id: newScreenTemplate || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateScreenError(data.error ?? 'Failed to create screen'); return }
      setScreens((prev) => [...prev, data])
      setNewScreenName('')
      setNewScreenTemplate('')
      setAddingScreen(false)
      toast('Screen added')
    } finally {
      setCreatingScreen(false)
    }
  }

  async function handleDeleteScreen(screenId: string) {
    if (confirmDeleteScreen !== screenId) {
      setConfirmDeleteScreen(screenId)
      setScreenError('')
      return
    }
    setDeletingScreen(screenId)
    setConfirmDeleteScreen(null)
    try {
      const res = await fetch(`/api/screens/${screenId}`, { method: 'DELETE' })
      if (res.ok) {
        setScreens((prev) => prev.filter((s) => s.id !== screenId))
        toast('Screen deleted')
      } else {
        const data = await res.json()
        setScreenError(data.error ?? 'Failed to delete screen')
        toast(data.error ?? 'Failed to delete screen', 'error')
      }
    } finally {
      setDeletingScreen(null)
    }
  }

  async function handleRegenToken(screenId: string) {
    if (!window.confirm('Regenerate token? The current URL for this screen will stop working immediately.')) return
    setRegenning(screenId)
    try {
      const res = await fetch(`/api/screens/${screenId}/token`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setScreens((prev) =>
          prev.map((s) => (s.id === screenId ? { ...s, screen_token: data.screen_token } : s))
        )
        toast('Token regenerated — old URL is now inactive', 'error')
      }
    } finally {
      setRegenning(null)
    }
  }

  async function handleCopyLink(screen: Screen) {
    await navigator.clipboard.writeText(`${baseUrl}/live?token=${screen.screen_token}`)
    setCopied(screen.id)
    setTimeout(() => setCopied(null), 2000)
  }

  function startEditName(screen: Screen) {
    setEditingNameId(screen.id)
    setEditingNameValue(screen.name)
  }

  async function commitEditName(screenId: string) {
    const trimmed = editingNameValue.trim()
    const screen = screens.find((s) => s.id === screenId)
    setEditingNameId(null)
    if (!trimmed || trimmed === screen?.name) return
    const res = await fetch(`/api/screens/${screenId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    if (res.ok) {
      const data = await res.json()
      setScreens((prev) => prev.map((s) => (s.id === screenId ? { ...s, name: data.name } : s)))
      toast('Screen renamed')
    }
  }

  async function handleTemplateChange(screenId: string, templateId: string) {
    const res = await fetch(`/api/screens/${screenId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId || null }),
    })
    if (res.ok) {
      const data = await res.json()
      setScreens((prev) =>
        prev.map((s) =>
          s.id === screenId
            ? { ...s, template_id: data.template_id, display_templates: data.display_templates }
            : s
        )
      )
      toast('Template updated')
    }
  }

  // ── Screen settings panel ──────────────────────────────────────────────────
  async function toggleScreenSettings(screenId: string) {
    if (expandedScreenId === screenId) {
      setExpandedScreenId(null)
      return
    }
    setExpandedScreenId(screenId)
    if (!(screenId in screenAdIds)) {
      setLoadingScreenAds(screenId)
      const data = await fetch(`/api/screens/${screenId}/ads`).then((r) => r.json())
      const ids: string[] = Array.isArray(data) ? data.map((row: { ad_id: string }) => row.ad_id) : []
      setScreenAdIds((prev) => ({ ...prev, [screenId]: ids }))
      setLoadingScreenAds(null)
    }
  }

  async function handleScreenLayoutChange(screenId: string, layout: string) {
    const res = await fetch(`/api/screens/${screenId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout }),
    })
    if (res.ok) {
      setScreens((prev) => prev.map((s) => (s.id === screenId ? { ...s, layout } : s)))
      toast('Layout updated')
    } else {
      toast('Failed to update layout', 'error')
    }
  }

  async function handleOrientationChange(screenId: string, orientation: 'landscape' | 'portrait') {
    const res = await fetch(`/api/screens/${screenId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orientation }),
    })
    if (res.ok) {
      setScreens((prev) => prev.map((s) => (s.id === screenId ? { ...s, orientation } : s)))
      toast(`Orientation set to ${orientation}`)
    }
  }

  async function handleRatesPerPageChange(screenId: string, value: number | null) {
    const res = await fetch(`/api/screens/${screenId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rates_per_page: value }),
    })
    if (res.ok) {
      setScreens((prev) => prev.map((s) => (s.id === screenId ? { ...s, rates_per_page: value } : s)))
      toast(value === null ? 'Reverted to auto currencies per page' : `Showing ${value} currencies per page`)
    } else {
      toast('Failed to update currencies per page', 'error')
    }
  }

  async function handleScreenAdToggle(screenId: string, adId: string) {
    const current = screenAdIds[screenId] ?? []
    const added = !current.includes(adId)
    const updated = added ? [...current, adId] : current.filter((id) => id !== adId)
    setScreenAdIds((prev) => ({ ...prev, [screenId]: updated }))
    const res = await fetch(`/api/screens/${screenId}/ads`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ad_ids: updated }),
    })
    if (res.ok) toast(added ? 'Ad added to screen' : 'Ad removed from screen')
  }

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin/branches" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
          ← Branches
        </a>
        <span className="text-zinc-700">/</span>
        <span className="text-white text-sm font-medium">{branch.name}</span>
      </div>

      {/* ── Branch Settings ── */}
      <form onSubmit={handleSave} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-5">
        <h2 className="text-white font-medium text-sm mb-4">Branch Settings</h2>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Branch Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setSaved(false) }}
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
                required
              />
            </div>
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Location Note</label>
              <input
                type="text"
                value={form.location_note}
                onChange={(e) => { setForm((f) => ({ ...f, location_note: e.target.value })); setSaved(false) }}
                placeholder="e.g. Ground floor, main entrance"
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-zinc-300 text-sm">Allow branch users to edit rates</p>
              <p className="text-zinc-600 text-xs mt-0.5">Branch users can override rates for this branch</p>
            </div>
            <button
              type="button"
              onClick={() => { setForm((f) => ({ ...f, allow_user_rate_edit: !f.allow_user_rate_edit })); setSaved(false) }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.allow_user_rate_edit ? 'bg-purple-600' : 'bg-zinc-700'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.allow_user_rate_edit ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-zinc-300 text-sm">Branch active</p>
              <p className="text-zinc-600 text-xs mt-0.5">Inactive branches do not appear in assignments</p>
            </div>
            <button
              type="button"
              onClick={() => { setForm((f) => ({ ...f, is_active: !f.is_active })); setSaved(false) }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_active ? 'bg-purple-600' : 'bg-zinc-700'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {saveError && <p className="text-red-400 text-sm mt-3">{saveError}</p>}
        <div className="flex items-center gap-3 mt-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && <span className="text-green-400 text-sm">Saved</span>}
        </div>
      </form>

      {/* ── Screens ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-white font-semibold text-sm">Screens</h2>
            <p className="text-zinc-500 text-xs mt-1">
              Each screen is an independent TV display with its own URL, template, orientation, and ads
            </p>
          </div>
          {!addingScreen && (
            <button
              onClick={() => {
                setAddingScreen(true)
                setNewScreenName(`Screen ${screens.length + 1}`)
                setNewScreenTemplate('')
              }}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Screen
            </button>
          )}
        </div>

        {/* Add Screen form */}
        {addingScreen && (
          <form
            onSubmit={handleCreateScreen}
            className="mb-5 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700"
          >
            <p className="text-zinc-300 text-xs font-semibold mb-3">New Screen</p>
            <div className="space-y-3">
              <div>
                <label className="block text-zinc-500 text-xs mb-1.5">Screen Name</label>
                <input
                  type="text"
                  value={newScreenName}
                  onChange={(e) => setNewScreenName(e.target.value)}
                  placeholder="e.g. Main Window, Counter 1"
                  autoFocus
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-zinc-500 text-xs mb-1.5">Template (optional)</label>
                <select
                  value={newScreenTemplate}
                  onChange={(e) => setNewScreenTemplate(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
                >
                  <option value="">Default Template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.is_default ? ' (Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {createScreenError && <p className="text-red-400 text-xs mt-2">{createScreenError}</p>}
            <div className="flex items-center gap-2 mt-4">
              <button
                type="submit"
                disabled={creatingScreen || !newScreenName.trim()}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-medium px-4 py-2 rounded-xl transition-colors"
              >
                {creatingScreen ? 'Adding…' : 'Add Screen'}
              </button>
              <button
                type="button"
                onClick={() => { setAddingScreen(false); setCreateScreenError('') }}
                className="text-zinc-500 hover:text-zinc-300 text-xs px-3 py-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Screen cards */}
        {screensLoading ? (
          <div className="text-zinc-600 text-sm py-8 text-center">Loading screens…</div>
        ) : screens.length === 0 ? (
          <div className="text-zinc-600 text-sm py-10 text-center">
            No screens configured yet. Add one above.
          </div>
        ) : (
          <div className="space-y-3">
            {screens.map((screen) => {
              const liveUrl = `${baseUrl}/live?token=${screen.screen_token}`
              const isDeleting = deletingScreen === screen.id
              const isConfirmDelete = confirmDeleteScreen === screen.id
              const isRegenning = regenning === screen.id
              const isCopied = copied === screen.id
              const isExpanded = expandedScreenId === screen.id
              const isPortrait = screen.orientation === 'portrait'
              const templateName = screen.display_templates?.name ?? 'Default Template'

              return (
                <div
                  key={screen.id}
                  className={`rounded-xl border overflow-hidden transition-all ${
                    isExpanded ? 'border-purple-700/50' : 'border-zinc-800'
                  }`}
                >
                  {/* Card header */}
                  <div className={`px-4 pt-4 pb-3 ${isExpanded ? 'bg-purple-950/10' : 'bg-zinc-800/40'}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-zinc-500 shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
                        </svg>
                      </div>

                      <div className="flex-1 min-w-0">
                        {editingNameId === screen.id ? (
                          <input
                            ref={editNameRef}
                            type="text"
                            value={editingNameValue}
                            onChange={(e) => setEditingNameValue(e.target.value)}
                            onBlur={() => commitEditName(screen.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEditName(screen.id)
                              if (e.key === 'Escape') setEditingNameId(null)
                            }}
                            className="w-full bg-zinc-800 border border-purple-500 text-white text-sm font-semibold rounded-lg px-2 py-0.5 focus:outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => startEditName(screen)}
                            className="text-left text-white text-sm font-semibold hover:text-purple-300 transition-colors w-full truncate"
                            title="Click to rename"
                          >
                            {screen.name}
                          </button>
                        )}
                        <p className="text-zinc-500 text-xs mt-0.5 truncate">{templateName}</p>
                      </div>

                      <span
                        className={`shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium ${
                          isPortrait
                            ? 'bg-blue-950/30 border-blue-800/40 text-blue-400'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                        }`}
                      >
                        {isPortrait ? '↕ Portrait' : '↔ Landscape'}
                      </span>
                    </div>
                  </div>

                  {/* Action bar */}
                  <div className={`flex items-center gap-1.5 px-4 pb-3.5 pt-0 ${isExpanded ? 'bg-purple-950/10' : 'bg-zinc-800/40'}`}>
                    <button
                      onClick={() => handleCopyLink(screen)}
                      title={liveUrl}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        isCopied
                          ? 'bg-green-900/30 border-green-700/50 text-green-400'
                          : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600 text-zinc-400 hover:text-zinc-200'
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

                    <a
                      href={liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-800 border border-zinc-700 hover:border-purple-600/60 text-zinc-400 hover:text-purple-300 rounded-lg transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                      Open
                    </a>

                    <button
                      onClick={() => toggleScreenSettings(screen.id)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        isExpanded
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Settings
                    </button>

                    <div className="flex-1" />

                    <button
                      onClick={() => handleRegenToken(screen.id)}
                      disabled={isRegenning}
                      title="Regenerate token — current URL will stop working"
                      className="p-1.5 text-zinc-600 hover:text-amber-400 disabled:opacity-40 transition-colors rounded-lg hover:bg-amber-400/8"
                    >
                      {isRegenning ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                      )}
                    </button>

                    <button
                      onClick={() => handleDeleteScreen(screen.id)}
                      disabled={isDeleting}
                      title={isConfirmDelete ? 'Click again to confirm delete' : 'Delete screen'}
                      className={`rounded-lg transition-colors disabled:opacity-40 ${
                        isConfirmDelete
                          ? 'px-2.5 py-1.5 bg-red-600/20 border border-red-700/50 text-red-400 text-xs font-medium'
                          : 'p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-400/8'
                      }`}
                    >
                      {isDeleting ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : isConfirmDelete ? (
                        'Confirm delete'
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Expanded settings panel */}
                  {isExpanded && (
                    <div className="border-t border-purple-800/25 bg-zinc-900/60 px-5 py-5 space-y-6">
                      {/* Orientation */}
                      <div>
                        <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">Orientation</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOrientationChange(screen.id, 'landscape')}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                              !isPortrait
                                ? 'bg-purple-600 border-purple-500 text-white'
                                : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <rect x="2" y="6" width="20" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Landscape
                          </button>
                          <button
                            onClick={() => handleOrientationChange(screen.id, 'portrait')}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                              isPortrait
                                ? 'bg-purple-600 border-purple-500 text-white'
                                : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <rect x="6" y="2" width="12" height="20" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Portrait
                          </button>
                        </div>
                        <p className="text-zinc-600 text-xs mt-2">
                          {isPortrait
                            ? 'Portrait: rates on top, ads below. Use for vertically rotated TVs.'
                            : 'Landscape: rates left, ads right. Standard TV orientation.'}
                        </p>
                      </div>

                      {/* Layout */}
                      <div>
                        <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">TV Layout</p>
                        <select
                          value={screen.layout ?? 'split-standard'}
                          onChange={(e) => handleScreenLayoutChange(screen.id, e.target.value)}
                          className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500 w-full"
                        >
                          {LAYOUT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <p className="text-zinc-600 text-xs mt-2">Controls how rates and ads are arranged on this screen&apos;s display.</p>
                      </div>

                      {/* Currencies Per Page */}
                      <div>
                        <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">Currencies Per Page</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {[null, 5, 7, 8, 10, 12, 15, 20, 25].map((preset) => {
                            const active = (screen.rates_per_page ?? null) === preset
                            return (
                              <button
                                key={preset ?? 'auto'}
                                onClick={() => handleRatesPerPageChange(screen.id, preset)}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                                  active
                                    ? 'bg-purple-600 border-purple-500 text-white'
                                    : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                                }`}
                              >
                                {preset === null ? 'Auto' : preset}
                              </button>
                            )
                          })}
                          <input
                            type="number"
                            min={3}
                            max={30}
                            placeholder="Custom"
                            value={rppDraft[screen.id] ?? ''}
                            onChange={(e) => setRppDraft((d) => ({ ...d, [screen.id]: e.target.value }))}
                            onBlur={() => {
                              const raw = rppDraft[screen.id]
                              if (!raw) return
                              const n = parseInt(raw, 10)
                              if (!isNaN(n) && n >= 3 && n <= 30) {
                                handleRatesPerPageChange(screen.id, n)
                              }
                              setRppDraft((d) => { const copy = { ...d }; delete copy[screen.id]; return copy })
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                            }}
                            className="w-20 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-500 placeholder:text-zinc-600"
                          />
                        </div>
                        <p className="text-zinc-600 text-xs mt-2">
                          {screen.rates_per_page
                            ? `Showing ${screen.rates_per_page} currencies per page. Font sizes scale automatically to fit.`
                            : 'Auto-detects based on screen height. Type a custom value or press Enter to apply.'}
                        </p>
                      </div>

                      {/* Template */}
                      <div>
                        <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-3">Template</p>
                        <select
                          value={screen.template_id ?? ''}
                          onChange={(e) => handleTemplateChange(screen.id, e.target.value)}
                          className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500 w-full max-w-xs"
                        >
                          <option value="">Default Template</option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (Default)' : ''}</option>
                          ))}
                        </select>
                      </div>

                      {/* Ads picker */}
                      <div>
                        <div className="flex items-center gap-2.5 mb-3">
                          <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Ads on This Screen</p>
                          {(screenAdIds[screen.id]?.length ?? 0) > 0 && (
                            <span className="text-xs bg-purple-600/20 border border-purple-700/30 text-purple-400 px-2 py-0.5 rounded-full">
                              {screenAdIds[screen.id].length} selected
                            </span>
                          )}
                        </div>
                        {loadingScreenAds === screen.id ? (
                          <div className="text-zinc-600 text-xs text-center py-4">Loading…</div>
                        ) : allAds.length === 0 ? (
                          <div className="text-zinc-600 text-xs py-3">
                            No active ads uploaded yet.{' '}
                            <a href="/admin/ads" className="text-purple-400 hover:text-purple-300">Go to Ads →</a>
                          </div>
                        ) : (
                          <>
                            <p className="text-zinc-600 text-xs mb-3">
                              Select which ads play on this screen. When none are selected, branch-wide ads are used.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {allAds.map((ad) => {
                                const isChecked = (screenAdIds[screen.id] ?? []).includes(ad.id)
                                return (
                                  <label
                                    key={ad.id}
                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                      isChecked
                                        ? 'bg-purple-950/40 border-purple-700/50'
                                        : 'bg-zinc-800/40 border-zinc-700/60 hover:border-zinc-600'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleScreenAdToggle(screen.id, ad.id)}
                                      className="accent-purple-500 shrink-0"
                                    />
                                    <div className="shrink-0 w-10 h-7 bg-zinc-700 rounded-lg overflow-hidden flex items-center justify-center">
                                      {ad.file_type === 'image' ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={ad.file_url} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-zinc-400 text-xs">▶</span>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-zinc-200 text-xs truncate font-medium">
                                        {ad.original_name ?? `${ad.file_type} ad`}
                                      </div>
                                      <div className="text-zinc-500 text-xs capitalize">
                                        {ad.file_type} · {ad.duration_seconds}s
                                      </div>
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {screenError && <p className="text-red-400 text-xs mt-3">{screenError}</p>}

        {confirmDeleteScreen && (
          <p className="text-zinc-500 text-xs mt-3 text-right">
            <button onClick={() => setConfirmDeleteScreen(null)} className="hover:text-zinc-300 transition-colors">
              Cancel delete
            </button>
          </p>
        )}
      </div>

      {/* ── Danger Zone ── */}
      <div className="bg-zinc-900 border border-red-900/40 rounded-xl p-5">
        <h2 className="text-red-400 font-medium text-sm mb-3">Danger Zone</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-zinc-300 text-sm">Delete this branch</p>
            <p className="text-zinc-600 text-xs mt-0.5">
              Permanently removes this branch, all its screens, tokens, and session history.
            </p>
          </div>
          <button
            onClick={handleDeleteBranch}
            disabled={deleting}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
              confirmBranchDelete
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-zinc-800 hover:bg-zinc-700 text-red-400 border border-red-900/50'
            }`}
          >
            {deleting ? 'Deleting…' : confirmBranchDelete ? 'Confirm Delete' : 'Delete Branch'}
          </button>
        </div>
        {confirmBranchDelete && (
          <p className="text-red-400 text-xs mt-2">
            Click Confirm Delete again to permanently remove this branch and all its screens.{' '}
            <button onClick={() => setConfirmBranchDelete(false)} className="underline">
              Cancel
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
