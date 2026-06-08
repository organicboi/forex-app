'use client'

import { useState } from 'react'

interface Customer {
  id: string
  name: string
  is_active: boolean
  plan_expires_at: string
  is_expired: boolean
  plan_name: string
  max_branches: number
  branch_count: number
  storage_used_mb: number
  storage_limit_mb: number
}

interface Key {
  id: string
  label: string | null
  issued_at: string
  expires_at: string | null
  redeemed_at: string | null
  redeemed_by: string | null
  is_revoked: boolean
}

interface Plan { id: string; name: string }

interface Props {
  customer: Customer
  keys: Key[]
  plans: Plan[]
  customerId: string
}

export default function CustomerDetail({ customer: initial, keys: initialKeys, plans, customerId }: Props) {
  const [customer, setCustomer] = useState(initial)
  const [keys, setKeys] = useState(initialKeys)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [newKeyCopied, setNewKeyCopied] = useState(false)
  const [generatingKey, setGeneratingKey] = useState(false)

  // Edit form
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    plan_id: '',
    plan_expires_at: customer.plan_expires_at.slice(0, 10),
    is_active: customer.is_active,
  })
  const [saving, setSaving] = useState(false)

  async function saveEdits() {
    setSaving(true)
    const body: Record<string, unknown> = { is_active: form.is_active }
    if (form.plan_expires_at) body.plan_expires_at = new Date(form.plan_expires_at).toISOString()
    if (form.plan_id) body.plan_id = form.plan_id

    const res = await fetch(`/api/distributor/customers/${customerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setCustomer((prev) => ({
        ...prev,
        is_active: form.is_active,
        plan_expires_at: form.plan_expires_at ? new Date(form.plan_expires_at).toISOString() : prev.plan_expires_at,
      }))
      setEditing(false)
    }
    setSaving(false)
  }

  async function revokeKey(keyId: string) {
    const res = await fetch(`/api/distributor/keys?id=${keyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_revoked: true }),
    })
    if (res.ok) {
      setKeys((prev) => prev.map((k) => k.id === keyId ? { ...k, is_revoked: true } : k))
    }
  }

  async function generateKey() {
    setGeneratingKey(true)
    const res = await fetch('/api/distributor/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customerId }),
    })
    if (res.ok) {
      const data = await res.json()
      setNewKey(data.license_key)
      setKeys((prev) => [data.key, ...prev])
    }
    setGeneratingKey(false)
  }

  const expiresIn = Math.round((new Date(customer.plan_expires_at).getTime() - Date.now()) / 86400000)

  return (
    <div className="flex flex-col gap-6">
      {/* Overview */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-white text-lg font-semibold">{customer.name}</div>
            <div className="text-zinc-500 text-sm mt-0.5">{customer.plan_name}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
              customer.is_active ? 'bg-green-900/40 text-green-400' : 'bg-zinc-800 text-zinc-500'
            }`}>
              {customer.is_active ? 'Active' : 'Inactive'}
            </span>
            {customer.is_expired && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-red-900/40 text-red-400">Expired</span>
            )}
            <button
              onClick={() => setEditing(true)}
              className="text-xs px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
            >
              Edit
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-zinc-600 text-xs mb-1">Branches</div>
            <div className="text-white font-medium">{customer.branch_count} / {customer.max_branches}</div>
          </div>
          <div>
            <div className="text-zinc-600 text-xs mb-1">Storage</div>
            <div className="text-white font-medium">{customer.storage_used_mb.toFixed(0)} / {customer.storage_limit_mb} MB</div>
          </div>
          <div>
            <div className="text-zinc-600 text-xs mb-1">Plan Expiry</div>
            <div className={`font-medium ${customer.is_expired ? 'text-red-400' : expiresIn < 30 ? 'text-yellow-400' : 'text-white'}`}>
              {customer.is_expired ? 'Expired' : `${expiresIn}d remaining`}
            </div>
          </div>
          <div>
            <div className="text-zinc-600 text-xs mb-1">Expires On</div>
            <div className="text-white font-medium text-xs">
              {new Date(customer.plan_expires_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="bg-zinc-900 border border-purple-800 rounded-xl p-5">
          <h2 className="text-white text-sm font-medium mb-4">Edit Customer</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-zinc-400 text-xs">Plan</label>
              <select
                value={form.plan_id}
                onChange={(e) => setForm((f) => ({ ...f, plan_id: e.target.value }))}
                className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Keep current</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-zinc-400 text-xs">Plan Expiry</label>
              <input
                type="date"
                value={form.plan_expires_at}
                onChange={(e) => setForm((f) => ({ ...f, plan_expires_at: e.target.value }))}
                className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-zinc-400 text-xs">Status</label>
              <select
                value={form.is_active ? '1' : '0'}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === '1' }))}
                className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg">Cancel</button>
            <button onClick={saveEdits} disabled={saving} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* License Keys */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 className="text-white text-sm font-medium">License Keys</h2>
          <button
            onClick={generateKey}
            disabled={generatingKey}
            className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {generatingKey ? 'Generating…' : 'Generate Key'}
          </button>
        </div>

        {newKey && (
          <div className="mx-4 my-3 bg-yellow-950 border border-yellow-800 rounded-lg p-3">
            <div className="text-yellow-400 text-xs font-medium mb-1">New key — shown once only</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-yellow-300 text-xs font-mono break-all">{newKey}</code>
              <button
                onClick={async () => { await navigator.clipboard.writeText(newKey); setNewKeyCopied(true); setTimeout(() => setNewKeyCopied(false), 2000) }}
                className="shrink-0 px-2 py-1 bg-yellow-800 hover:bg-yellow-700 text-yellow-200 text-xs rounded"
              >
                {newKeyCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {keys.length === 0 ? (
          <div className="p-8 text-center text-zinc-600 text-sm">No keys issued yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800/60">
                <th className="text-left px-4 py-2 text-zinc-500 text-xs font-medium">Label</th>
                <th className="text-left px-4 py-2 text-zinc-500 text-xs font-medium">Issued</th>
                <th className="text-left px-4 py-2 text-zinc-500 text-xs font-medium">Redeemed</th>
                <th className="text-left px-4 py-2 text-zinc-500 text-xs font-medium">Status</th>
                <th className="w-20 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-zinc-800/30 last:border-0">
                  <td className="px-4 py-2.5 text-zinc-300 text-xs">{k.label ?? '—'}</td>
                  <td className="px-4 py-2.5 text-zinc-500 text-xs">{new Date(k.issued_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-zinc-500 text-xs">
                    {k.redeemed_at ? new Date(k.redeemed_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      k.is_revoked ? 'bg-red-900/40 text-red-400' :
                      k.redeemed_at ? 'bg-zinc-800 text-zinc-500' :
                      'bg-green-900/40 text-green-400'
                    }`}>
                      {k.is_revoked ? 'Revoked' : k.redeemed_at ? 'Used' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {!k.is_revoked && !k.redeemed_at && (
                      <button
                        onClick={() => revokeKey(k.id)}
                        className="text-xs text-red-500 hover:text-red-300 transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
