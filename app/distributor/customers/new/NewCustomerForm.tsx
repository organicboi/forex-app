'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Plan {
  id: string
  name: string
  max_branches: number
  storage_mb: number
  duration_days: number
}

export default function NewCustomerForm({ plans }: { plans: Plan[] }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    plan_id: plans[0]?.id ?? '',
    expires_days: '365',
    primary_color: '#4c195a',
    base_currency: 'AED',
    business_name: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [licenseKey, setLicenseKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function set(k: keyof typeof form, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/distributor/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        plan_id: form.plan_id,
        expires_days: Number(form.expires_days) || 365,
        primary_color: form.primary_color,
        base_currency: form.base_currency.toUpperCase(),
        business_name: form.business_name || undefined,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to create customer')
      setLoading(false)
      return
    }

    setLicenseKey(data.license_key)
    setLoading(false)
  }

  async function copyKey() {
    if (!licenseKey) return
    await navigator.clipboard.writeText(licenseKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (licenseKey) {
    return (
      <div className="max-w-lg">
        <div className="bg-green-950 border border-green-800 rounded-xl p-6 mb-6">
          <div className="text-green-400 font-medium mb-1">Customer created</div>
          <div className="text-green-300 text-sm">The license key below is shown <strong>once only</strong>. Copy it now and send it to the customer.</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
          <div className="text-zinc-500 text-xs mb-2 font-medium">License Key</div>
          <div className="flex items-center gap-3">
            <code className="flex-1 text-purple-300 text-sm font-mono break-all bg-zinc-800 px-3 py-2 rounded-lg">
              {licenseKey}
            </code>
            <button
              onClick={copyKey}
              className="shrink-0 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="text-red-400 text-xs mt-2">
            ⚠ This key will not be shown again. Store it securely.
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push('/distributor/customers')}
            className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Back to Customers
          </button>
          <button
            onClick={() => {
              setLicenseKey(null)
              setForm({ name: '', plan_id: plans[0]?.id ?? '', expires_days: '365', primary_color: '#4c195a', base_currency: 'AED', business_name: '' })
            }}
            className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Create Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg flex flex-col gap-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-zinc-400 text-sm font-medium">Business Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Nova Currency Exchange"
            required
            className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-zinc-400 text-sm font-medium">Plan *</label>
          <select
            value={form.plan_id}
            onChange={(e) => set('plan_id', e.target.value)}
            required
            className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {plans.length === 0 && <option value="">No active plans</option>}
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.max_branches} branches, {p.storage_mb} MB
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-400 text-sm font-medium">Duration (days)</label>
            <input
              type="number"
              value={form.expires_days}
              onChange={(e) => set('expires_days', e.target.value)}
              min={1}
              className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-400 text-sm font-medium">Base Currency</label>
            <input
              type="text"
              value={form.base_currency}
              onChange={(e) => set('base_currency', e.target.value.toUpperCase())}
              maxLength={3}
              placeholder="AED"
              className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-400 text-sm font-medium">Brand Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.primary_color}
                onChange={(e) => set('primary_color', e.target.value)}
                className="w-10 h-9 rounded cursor-pointer bg-transparent border-0"
              />
              <input
                type="text"
                value={form.primary_color}
                onChange={(e) => set('primary_color', e.target.value)}
                placeholder="#4c195a"
                className="flex-1 bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-zinc-400 text-sm font-medium">Trading Name</label>
            <input
              type="text"
              value={form.business_name}
              onChange={(e) => set('business_name', e.target.value)}
              placeholder="Optional"
              className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !form.name || !form.plan_id}
          className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {loading ? 'Creating…' : 'Create Customer'}
        </button>
      </div>
    </form>
  )
}
