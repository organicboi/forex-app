'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
}

interface Props {
  initialBranches: Branch[]
  maxBranches: number
}

const LAYOUT_LABELS: Record<string, string> = {
  'split-standard': 'Split (Standard)',
  'rates-full': 'Rates Only',
  'ads-full': 'Ads Only',
  'portrait': 'Portrait',
  'rates-wide': 'Rates Wide',
}

const LAYOUT_OPTIONS = Object.entries(LAYOUT_LABELS)

export default function BranchList({ initialBranches, maxBranches }: Props) {
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>(initialBranches)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState({ name: '', location_note: '', layout: 'split-standard' })

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
      if (!res.ok) {
        setCreateError(data.error ?? 'Failed to create branch')
        return
      }
      setBranches((prev) => [...prev, { ...data, screens_online: 0, screens_total: 0 }])
      setForm({ name: '', location_note: '', layout: 'split-standard' })
      setShowCreate(false)
      router.refresh()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Branches</h1>
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 text-sm">
            {activeBranchCount} / {maxBranches} active
          </span>
          <button
            onClick={() => setShowCreate((v) => !v)}
            disabled={activeBranchCount >= maxBranches}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Add Branch
          </button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
          <h2 className="text-white font-medium text-sm mb-4">New Branch</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Branch Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. City Centre"
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
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
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">TV Layout</label>
              <select
                value={form.layout}
                onChange={(e) => setForm((f) => ({ ...f, layout: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
              >
                {LAYOUT_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          {createError && (
            <p className="text-red-400 text-sm mt-3">{createError}</p>
          )}
          <div className="flex items-center gap-2 mt-4">
            <button
              type="submit"
              disabled={creating || !form.name.trim()}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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

      {branches.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No branches yet.</p>
          <p className="text-zinc-600 text-xs mt-1">Add your first branch to get started.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Branch</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Layout</th>
                <th className="text-center px-4 py-3 text-zinc-500 font-medium">Screens</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => (
                <tr key={branch.id} className="border-b border-zinc-800/50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{branch.name}</div>
                    {branch.location_note && (
                      <div className="text-zinc-500 text-xs mt-0.5">{branch.location_note}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {LAYOUT_LABELS[branch.layout] ?? branch.layout}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={branch.screens_online > 0 ? 'text-green-400' : 'text-zinc-600'}>
                      {branch.screens_online}
                    </span>
                    <span className="text-zinc-600"> / {branch.screens_total}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                        branch.is_active
                          ? 'bg-green-900/40 text-green-400'
                          : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${branch.is_active ? 'bg-green-400' : 'bg-zinc-500'}`} />
                      {branch.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/branches/${branch.id}`}
                      className="text-purple-400 hover:text-purple-300 text-xs font-medium transition-colors"
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
