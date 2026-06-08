'use client'

import { useState } from 'react'
import Image from 'next/image'

interface CurrencyRow {
  currency_id: string
  decimal_places: number | null
  currencies: {
    code: string
    name: string
    flag_path: string
    default_decimals: number
  }
  base_rate: { buy: number; sell: number; transfer: number; mode: string; updated_at: string | null }
  override: { buy: number; sell: number; transfer: number; updated_at: string | null } | null
  effective: { buy: number; sell: number; transfer: number }
}

interface Props {
  rows: CurrencyRow[]
  allowEdit: boolean
}

interface EditableRate {
  buy: string
  sell: string
  transfer: string
}

export default function BranchRateView({ rows, allowEdit }: Props) {
  const [edits, setEdits] = useState<Record<string, EditableRate>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const decimals = (row: CurrencyRow) =>
    row.decimal_places ?? (row.currencies as { default_decimals: number }).default_decimals

  function getEdited(row: CurrencyRow): EditableRate {
    const e = edits[row.currency_id]
    if (e) return e
    return {
      buy: String(row.effective.buy),
      sell: String(row.effective.sell),
      transfer: String(row.effective.transfer),
    }
  }

  function setField(currency_id: string, field: 'buy' | 'sell' | 'transfer', value: string) {
    const row = rows.find((r) => r.currency_id === currency_id)
    if (!row) return
    const current = getEdited(row)
    setEdits((prev) => ({ ...prev, [currency_id]: { ...current, [field]: value } }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const payload = rows.map((row) => {
        const e = getEdited(row)
        return {
          currency_id: row.currency_id,
          buy: Number(e.buy) || 0,
          sell: Number(e.sell) || 0,
          transfer: Number(e.transfer) || 0,
        }
      })
      const res = await fetch('/api/branch/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to save'); return }
      setEdits({})
      setSaved(true)
      setLastSaved(new Date())
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = Object.keys(edits).length > 0

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Exchange Rates</h1>
          {!allowEdit && (
            <p className="text-zinc-500 text-xs mt-1">Read-only — rate editing is disabled for this branch</p>
          )}
        </div>
        {allowEdit && (
          <div className="flex items-center gap-3">
            {saved && !hasChanges && <span className="text-green-400 text-sm">Saved</span>}
            {lastSaved && <span className="text-zinc-500 text-sm">Last saved: {lastSaved.toLocaleTimeString()}</span>}
            {error && <span className="text-red-400 text-sm">{error}</span>}
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save Branch Rates'}
            </button>
          </div>
        )}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-500 font-medium w-52">Currency</th>
              <th className="text-right px-4 py-3 text-zinc-500 font-medium">Buy</th>
              <th className="text-right px-4 py-3 text-zinc-500 font-medium">Sell</th>
              <th className="text-right px-4 py-3 text-zinc-500 font-medium">Transfer</th>
              {allowEdit && (
                <th className="text-center px-4 py-3 text-zinc-500 font-medium w-24">Override</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const dec = decimals(row)
              const e = getEdited(row)
              const isEdited = !!edits[row.currency_id]
              const hasOverride = !!row.override

              const cur = row.currencies as { code: string; name: string; flag_path: string; default_decimals: number }

              return (
                <tr
                  key={row.currency_id}
                  className={`border-b border-zinc-800/50 last:border-0 ${isEdited ? 'bg-purple-950/10' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-4 overflow-hidden rounded-sm flex-shrink-0">
                        <Image
                          src={cur.flag_path}
                          alt={cur.code}
                          width={24}
                          height={16}
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <span className="text-white font-medium">{cur.code}</span>
                        <span className="text-zinc-500 ml-2 text-xs">{cur.name}</span>
                      </div>
                    </div>
                  </td>
                  {(['buy', 'sell', 'transfer'] as const).map((field) => (
                    <td key={field} className="px-4 py-3 text-right">
                      {allowEdit ? (
                        <input
                          type="number"
                          step={Math.pow(10, -dec)}
                          min={0}
                          value={e[field]}
                          onChange={(ev) => setField(row.currency_id, field, ev.target.value)}
                          className="w-28 text-right bg-transparent border border-transparent rounded-md px-2 py-1.5 text-sm font-mono text-zinc-300 focus:outline-none focus:border-purple-500 focus:bg-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 transition-colors"
                        />
                      ) : (
                        <span className={`font-mono text-sm ${hasOverride ? 'text-purple-300' : 'text-zinc-300'}`}>
                          {row.effective[field].toFixed(dec)}
                        </span>
                      )}
                    </td>
                  ))}
                  {allowEdit && (
                    <td className="px-4 py-3 text-center">
                      {hasOverride && (
                        <span className="text-xs text-purple-400 bg-purple-900/30 px-2 py-0.5 rounded-full">
                          Override
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
