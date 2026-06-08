'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'

interface RateRow {
  currency_id: string
  decimal_places: number | null
  currencies: {
    code: string
    name: string
    flag_path: string
    default_decimals: number
  }
  rates: Array<{
    buy: number
    sell: number
    transfer: number
    mode: string
    updated_at: string | null
  }>
}

interface EditableRate {
  buy: string
  sell: string
  transfer: string
}

interface Props {
  initialData: RateRow[]
  baseCurrency: string
}

export default function RateTable({ initialData, baseCurrency }: Props) {
  const [edits, setEdits] = useState<Record<string, EditableRate>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  function getRate(row: RateRow) {
    const r = row.rates?.[0] ?? { buy: 0, sell: 0, transfer: 0 }
    const e = edits[row.currency_id]
    return {
      buy: e?.buy ?? String(r.buy),
      sell: e?.sell ?? String(r.sell),
      transfer: e?.transfer ?? String(r.transfer),
    }
  }

  function setField(currency_id: string, field: 'buy' | 'sell' | 'transfer', value: string) {
    const row = initialData.find((r) => r.currency_id === currency_id)
    if (!row) return
    const current = getRate(row)
    setEdits((prev) => ({
      ...prev,
      [currency_id]: { ...current, [field]: value },
    }))
    setSaved(false)
  }

  function hasChanges() {
    return Object.keys(edits).length > 0
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const payload = initialData.map((row) => {
        const rate = getRate(row)
        return {
          currency_id: row.currency_id,
          buy: Number(rate.buy) || 0,
          sell: Number(rate.sell) || 0,
          transfer: Number(rate.transfer) || 0,
        }
      })

      const res = await fetch('/api/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Failed to save rates')
        return
      }

      setEdits({})
      setSaved(true)
      setLastSaved(new Date())
    } finally {
      setSaving(false)
    }
  }

  const decimals = (row: RateRow) =>
    row.decimal_places ?? row.currencies.default_decimals

  const placeholder = (row: RateRow) =>
    (0).toFixed(decimals(row))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-zinc-500">
          Base currency: <span className="text-zinc-300 font-medium">{baseCurrency}</span>
          {lastSaved && (
            <span className="ml-4">
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saved && !hasChanges() && <span className="text-green-400 text-sm">Saved</span>}
          {error && <span className="text-red-400 text-sm max-w-xs truncate">{error}</span>}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges()}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Rates'}
          </button>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-500 font-medium w-52">Currency</th>
              <th className="text-right px-4 py-3 text-zinc-500 font-medium">Buy</th>
              <th className="text-right px-4 py-3 text-zinc-500 font-medium">Sell</th>
              <th className="text-right px-4 py-3 text-zinc-500 font-medium">Transfer</th>
            </tr>
          </thead>
          <tbody>
            {initialData.map((row) => {
              const rate = getRate(row)
              const dec = decimals(row)
              const isEdited = !!edits[row.currency_id]

              return (
                <tr
                  key={row.currency_id}
                  className={`border-b border-zinc-800/50 last:border-0 ${isEdited ? 'bg-purple-950/10' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-4 overflow-hidden rounded-sm flex-shrink-0">
                        <Image
                          src={row.currencies.flag_path}
                          alt={row.currencies.code}
                          width={24}
                          height={16}
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <span className="text-white font-medium">{row.currencies.code}</span>
                        <span className="text-zinc-500 ml-2 text-xs">{row.currencies.name}</span>
                      </div>
                    </div>
                  </td>
                  {(['buy', 'sell', 'transfer'] as const).map((field) => (
                    <td key={field} className="px-4 py-3 text-right">
                      <RateInput
                        value={rate[field]}
                        decimals={dec}
                        placeholder={placeholder(row)}
                        onChange={(val) => setField(row.currency_id, field, val)}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {hasChanges() && (
        <p className="text-zinc-600 text-xs mt-3">
          {Object.keys(edits).length} currency row{Object.keys(edits).length !== 1 ? 's' : ''} edited — press Save Rates to apply.
        </p>
      )}
    </div>
  )
}

function RateInput({
  value,
  decimals,
  placeholder,
  onChange,
}: {
  value: string
  decimals: number
  placeholder: string
  onChange: (v: string) => void
}) {
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="inline-flex justify-end">
      <input
        ref={inputRef}
        type="number"
        step={Math.pow(10, -decimals)}
        min={0}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`w-28 text-right bg-transparent border rounded-md px-2 py-1.5 text-sm transition-colors font-mono focus:outline-none ${
          focused
            ? 'border-purple-500 bg-zinc-800 text-white'
            : 'border-transparent text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/50'
        }`}
      />
    </div>
  )
}
