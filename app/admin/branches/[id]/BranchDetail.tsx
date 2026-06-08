'use client'

import { useState } from 'react'
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

interface Props {
  branch: Branch
  baseUrl: string
}

const LAYOUT_OPTIONS = [
  { value: 'split-standard', label: 'Split (Standard) — 64% rates / 36% ads' },
  { value: 'rates-full', label: 'Rates Only — full screen' },
  { value: 'ads-full', label: 'Ads Only — full screen' },
  { value: 'portrait', label: 'Portrait — rates top / ads bottom' },
  { value: 'rates-wide', label: 'Rates Wide — 75% rates / 25% ads' },
]

export default function BranchDetail({ branch, baseUrl }: Props) {
  const router = useRouter()
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

  const [token, setToken] = useState(branch.branch_token)
  const [tokenVisible, setTokenVisible] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [urlCopied, setUrlCopied] = useState(false)

  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const tvUrl = `${baseUrl}/live?token=${token}`

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
      if (!res.ok) {
        setSaveError(data.error ?? 'Failed to save')
        return
      }
      setSaved(true)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleRegenerate() {
    if (!window.confirm('Regenerate token? The current TV URL will stop working immediately.')) return
    setRegenerating(true)
    try {
      const res = await fetch(`/api/branches/${branch.id}/token`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setToken(data.branch_token)
        setTokenVisible(true)
      }
    } finally {
      setRegenerating(false)
    }
  }

  async function copyToken() {
    await navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(tvUrl)
    setUrlCopied(true)
    setTimeout(() => setUrlCopied(false), 2000)
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      const res = await fetch(`/api/branches/${branch.id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/admin/branches')
        router.refresh()
      }
    } finally {
      setDeleting(false)
    }
  }

  const maskedToken = token.slice(0, 8) + '●'.repeat(24) + token.slice(-8)

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin/branches" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
          ← Branches
        </a>
        <span className="text-zinc-700">/</span>
        <span className="text-white text-sm font-medium">{branch.name}</span>
      </div>

      {/* Settings form */}
      <form onSubmit={handleSave} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-5">
        <h2 className="text-white font-medium text-sm mb-4">Branch Settings</h2>
        <div className="flex flex-col gap-4">
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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-zinc-300 text-sm">Allow branch users to edit rates</p>
              <p className="text-zinc-600 text-xs mt-0.5">Branch users can override rates for this branch</p>
            </div>
            <button
              type="button"
              onClick={() => { setForm((f) => ({ ...f, allow_user_rate_edit: !f.allow_user_rate_edit })); setSaved(false) }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                form.allow_user_rate_edit ? 'bg-purple-600' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  form.allow_user_rate_edit ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-zinc-300 text-sm">Branch active</p>
              <p className="text-zinc-600 text-xs mt-0.5">Inactive branches do not appear in assignments</p>
            </div>
            <button
              type="button"
              onClick={() => { setForm((f) => ({ ...f, is_active: !f.is_active })); setSaved(false) }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                form.is_active ? 'bg-purple-600' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  form.is_active ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
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

      {/* TV Token */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-5">
        <h2 className="text-white font-medium text-sm mb-1">TV Screen Token</h2>
        <p className="text-zinc-500 text-xs mb-4">
          This token authenticates the TV screen. Keep it secret — anyone with this URL can display your rates.
        </p>

        <div className="mb-3">
          <label className="block text-zinc-500 text-xs mb-1.5">TV URL</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs px-3 py-2 rounded-lg font-mono truncate">
              {tvUrl}
            </code>
            <button
              onClick={copyUrl}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-700 transition-colors whitespace-nowrap"
            >
              {urlCopied ? 'Copied!' : 'Copy URL'}
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-zinc-500 text-xs mb-1.5">Token</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs px-3 py-2 rounded-lg font-mono truncate">
              {tokenVisible ? token : maskedToken}
            </code>
            <button
              onClick={() => setTokenVisible((v) => !v)}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-700 transition-colors"
            >
              {tokenVisible ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={copyToken}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs px-3 py-2 rounded-lg border border-zinc-700 transition-colors whitespace-nowrap"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="bg-amber-600/20 hover:bg-amber-600/30 border border-amber-700/50 text-amber-400 text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {regenerating ? 'Regenerating…' : 'Regenerate Token'}
        </button>
        <p className="text-zinc-600 text-xs mt-2">
          Regenerating invalidates the current URL immediately. Update any active TV screens.
        </p>
      </div>

      {/* Danger zone */}
      <div className="bg-zinc-900 border border-red-900/40 rounded-xl p-5">
        <h2 className="text-red-400 font-medium text-sm mb-3">Danger Zone</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-zinc-300 text-sm">Delete this branch</p>
            <p className="text-zinc-600 text-xs mt-0.5">
              Permanently removes the branch, its token, and all screen sessions.
            </p>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
              confirmDelete
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-zinc-800 hover:bg-zinc-700 text-red-400 border border-red-900/50'
            }`}
          >
            {deleting ? 'Deleting…' : confirmDelete ? 'Confirm Delete' : 'Delete Branch'}
          </button>
        </div>
        {confirmDelete && (
          <p className="text-red-400 text-xs mt-2">
            Click Confirm Delete again to permanently remove this branch.{' '}
            <button onClick={() => setConfirmDelete(false)} className="underline">
              Cancel
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
