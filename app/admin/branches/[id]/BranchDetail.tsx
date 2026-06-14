'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

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
  is_active: boolean
  created_at: string
  display_templates: { id: string; name: string } | null
}

interface Props {
  branch: Branch
  baseUrl: string
}

const LAYOUT_OPTIONS = [
  { value: 'split-standard', label: 'Split (Standard) — 64% rates / 36% ads' },
  { value: 'rates-full',     label: 'Rates Only — full screen' },
  { value: 'ads-full',       label: 'Ads Only — full screen' },
  { value: 'portrait',       label: 'Portrait — rates top / ads bottom' },
  { value: 'rates-wide',     label: 'Rates Wide — 75% rates / 25% ads' },
]

export default function BranchDetail({ branch, baseUrl }: Props) {
  const router = useRouter()

  // ── Branch settings ────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name: branch.name,
    location_note: branch.location_note ?? '',
    layout: branch.layout,
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

  // ── Branch delete ──────────────────────────────────────────────────────────
  const [deleting, setDeleting] = useState(false)
  const [confirmBranchDelete, setConfirmBranchDelete] = useState(false)

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch(`/api/branches/${branch.id}/screens`).then((r) => r.json()),
      fetch('/api/templates').then((r) => r.json()),
    ]).then(([screensData, templatesData]) => {
      setScreens(Array.isArray(screensData) ? screensData : [])
      setTemplates(Array.isArray(templatesData) ? templatesData : [])
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
      } else {
        const data = await res.json()
        setScreenError(data.error ?? 'Failed to delete screen')
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
    }
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

          <div>
            <label className="block text-zinc-400 text-xs mb-1.5">TV Layout</label>
            <select
              value={form.layout}
              onChange={(e) => { setForm((f) => ({ ...f, layout: e.target.value })); setSaved(false) }}
              className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
            >
              {LAYOUT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
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
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-white font-medium text-sm">Screens</h2>
            <p className="text-zinc-500 text-xs mt-0.5">
              Each screen is an independent TV display with its own URL and template
            </p>
          </div>
          {!addingScreen && (
            <button
              onClick={() => {
                setAddingScreen(true)
                setNewScreenName(`Screen ${screens.length + 1}`)
                setNewScreenTemplate('')
              }}
              className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              + Add Screen
            </button>
          )}
        </div>

        {/* Add Screen inline form */}
        {addingScreen && (
          <form
            onSubmit={handleCreateScreen}
            className="flex items-center gap-2 p-3 bg-zinc-800/50 rounded-lg mb-4 border border-zinc-700"
          >
            <input
              type="text"
              value={newScreenName}
              onChange={(e) => setNewScreenName(e.target.value)}
              placeholder="Screen name"
              autoFocus
              className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500"
            />
            <select
              value={newScreenTemplate}
              onChange={(e) => setNewScreenTemplate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-500 max-w-45"
            >
              <option value="">— Default Template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_default ? ' (Default)' : ''}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={creatingScreen || !newScreenName.trim()}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              {creatingScreen ? 'Adding…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => { setAddingScreen(false); setCreateScreenError('') }}
              className="text-zinc-500 hover:text-zinc-300 text-xs px-2 py-1.5 transition-colors"
            >
              Cancel
            </button>
          </form>
        )}
        {createScreenError && <p className="text-red-400 text-xs mb-3">{createScreenError}</p>}

        {/* Screen rows */}
        {screensLoading ? (
          <div className="text-zinc-600 text-sm py-6 text-center">Loading…</div>
        ) : screens.length === 0 ? (
          <div className="text-zinc-600 text-sm py-8 text-center">
            No screens configured.
          </div>
        ) : (
          <div className="space-y-1.5">
            {screens.map((screen) => {
              const liveUrl = `${baseUrl}/live?token=${screen.screen_token}`
              const isDeleting = deletingScreen === screen.id
              const isConfirmDelete = confirmDeleteScreen === screen.id
              const isRegenning = regenning === screen.id
              const isCopied = copied === screen.id

              return (
                <div
                  key={screen.id}
                  className="flex items-center gap-2 px-3 py-2.5 bg-zinc-800/30 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  {/* Screen icon */}
                  <div className="shrink-0 text-zinc-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
                    </svg>
                  </div>

                  {/* Screen name — inline editable */}
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
                        className="w-full bg-zinc-800 border border-purple-600 text-white text-sm rounded px-2 py-0.5 focus:outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => startEditName(screen)}
                        className="text-left text-white text-sm font-medium hover:text-purple-300 transition-colors truncate w-full"
                        title="Click to rename"
                      >
                        {screen.name}
                      </button>
                    )}
                  </div>

                  {/* Template selector */}
                  <select
                    value={screen.template_id ?? ''}
                    onChange={(e) => handleTemplateChange(screen.id, e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-purple-500 max-w-37.5 shrink-0"
                  >
                    <option value="">Default Template</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>

                  {/* Copy link */}
                  <button
                    onClick={() => handleCopyLink(screen)}
                    title={liveUrl}
                    className={`shrink-0 text-xs px-2.5 py-1 rounded-lg border transition-colors whitespace-nowrap ${
                      isCopied
                        ? 'bg-green-900/30 border-green-700/50 text-green-400'
                        : 'bg-zinc-800 border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-100'
                    }`}
                  >
                    {isCopied ? '✓ Copied' : 'Copy Link'}
                  </button>

                  {/* Open live screen */}
                  <a
                    href={liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs px-2.5 py-1 bg-zinc-800 border border-zinc-700 hover:border-purple-600 text-zinc-300 hover:text-purple-300 rounded-lg transition-colors whitespace-nowrap"
                    title="Open live screen in new tab"
                  >
                    ↗ Open
                  </a>

                  {/* Regen token */}
                  <button
                    onClick={() => handleRegenToken(screen.id)}
                    disabled={isRegenning}
                    title="Regenerate token — current URL will stop working"
                    className="shrink-0 p-1.5 text-zinc-600 hover:text-amber-400 disabled:opacity-40 transition-colors rounded"
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

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteScreen(screen.id)}
                    disabled={isDeleting}
                    title={isConfirmDelete ? 'Click again to confirm' : 'Delete screen'}
                    className={`shrink-0 rounded transition-colors disabled:opacity-40 ${
                      isConfirmDelete
                        ? 'px-2 py-1 bg-red-600/20 border border-red-700/50 text-red-400 text-xs'
                        : 'p-1.5 text-zinc-600 hover:text-red-400'
                    }`}
                  >
                    {isDeleting ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : isConfirmDelete ? (
                      'Confirm?'
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {screenError && <p className="text-red-400 text-xs mt-2">{screenError}</p>}

        {confirmDeleteScreen && (
          <p className="text-zinc-500 text-xs mt-2 text-right">
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
