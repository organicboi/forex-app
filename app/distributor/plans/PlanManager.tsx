'use client'

import { useState } from 'react'

interface Plan {
  id: string
  name: string
  max_branches: number
  storage_mb: number
  allow_live_rates: boolean
  allow_excel_import: boolean
  allow_layout_config: boolean
  allow_branch_rate_edit: boolean
  duration_days: number
  price_note: string | null
  is_active: boolean
  created_at: string
}

const EMPTY_FORM = {
  name: '',
  max_branches: '5',
  storage_mb: '500',
  allow_live_rates: true,
  allow_excel_import: true,
  allow_layout_config: true,
  allow_branch_rate_edit: false,
  duration_days: '365',
  price_note: '',
}

export default function PlanManager({ initialPlans }: { initialPlans: Plan[] }) {
  const [plans, setPlans] = useState(initialPlans)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setF(k: keyof typeof form, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function createPlan() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/distributor/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        max_branches: Number(form.max_branches),
        storage_mb: Number(form.storage_mb),
        allow_live_rates: form.allow_live_rates,
        allow_excel_import: form.allow_excel_import,
        allow_layout_config: form.allow_layout_config,
        allow_branch_rate_edit: form.allow_branch_rate_edit,
        duration_days: Number(form.duration_days),
        price_note: form.price_note || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to create plan')
    } else {
      setPlans((prev) => [...prev, data])
      setForm(EMPTY_FORM)
      setShowForm(false)
    }
    setSaving(false)
  }

  async function toggleActive(id: string, current: boolean) {
    const res = await fetch(`/api/distributor/plans?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current }),
    })
    if (res.ok) setPlans((prev) => prev.map((p) => p.id === id ? { ...p, is_active: !current } : p))
  }

  async function deletePlan(id: string) {
    const res = await fetch(`/api/distributor/plans?id=${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      setPlans((prev) => prev.filter((p) => p.id !== id))
    } else {
      alert(data.error ?? 'Cannot delete plan')
    }
  }

  const TOGGLE_FIELDS: [keyof typeof form, string][] = [
    ['allow_live_rates', 'Live Rates'],
    ['allow_excel_import', 'Excel Import'],
    ['allow_layout_config', 'Layout Config'],
    ['allow_branch_rate_edit', 'Branch Rate Edit'],
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Plan list */}
      {plans.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No plans yet.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Name</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium">Branches</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium">Storage</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium">Duration</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Features</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Status</th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-b border-zinc-800/40 last:border-0">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{p.name}</div>
                    {p.price_note && <div className="text-zinc-600 text-xs mt-0.5">{p.price_note}</div>}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-300 text-xs">{p.max_branches}</td>
                  <td className="px-4 py-3 text-right text-zinc-300 text-xs">{p.storage_mb} MB</td>
                  <td className="px-4 py-3 text-right text-zinc-300 text-xs">{p.duration_days}d</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.allow_live_rates && <span className="text-xs bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded">Live</span>}
                      {p.allow_excel_import && <span className="text-xs bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded">Excel</span>}
                      {p.allow_layout_config && <span className="text-xs bg-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded">Layout</span>}
                      {p.allow_branch_rate_edit && <span className="text-xs bg-yellow-900/30 text-yellow-400 px-1.5 py-0.5 rounded">BranchEdit</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(p.id, p.is_active)}
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors ${
                        p.is_active ? 'bg-green-900/40 text-green-400' : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      {p.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deletePlan(p.id)}
                      className="text-xs text-red-600 hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create form */}
      {showForm ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-white text-sm font-medium mb-4">New Plan</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            {[
              ['name', 'Name', 'text'],
              ['max_branches', 'Max Branches', 'number'],
              ['storage_mb', 'Storage (MB)', 'number'],
              ['duration_days', 'Duration (days)', 'number'],
              ['price_note', 'Price note', 'text'],
            ].map(([key, label, type]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-zinc-400 text-xs">{label}</label>
                <input
                  type={type}
                  value={String(form[key as keyof typeof form])}
                  onChange={(e) => setF(key as keyof typeof form, e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 mb-4">
            {TOGGLE_FIELDS.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form[key])}
                  onChange={(e) => setF(key, e.target.checked)}
                  className="accent-purple-500"
                />
                <span className="text-zinc-300 text-sm">{label}</span>
              </label>
            ))}
          </div>
          {error && (
            <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-3 py-2 rounded-lg mb-3">{error}</div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg">Cancel</button>
            <button onClick={createPlan} disabled={saving || !form.name} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
              {saving ? 'Creating…' : 'Create Plan'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="self-start px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Plan
        </button>
      )}
    </div>
  )
}
