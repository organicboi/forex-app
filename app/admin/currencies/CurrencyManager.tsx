'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'

interface CurrencyRow {
  id: string
  currency_id: string
  is_enabled: boolean
  display_order: number
  decimal_places: number | null
  currencies: {
    code: string
    name: string
    flag_path: string
    default_decimals: number
  }
}

interface Props {
  initialData: CurrencyRow[]
}

const DECIMAL_OPTIONS = [0, 2, 3, 4]

export default function CurrencyManager({ initialData }: Props) {
  const [rows, setRows] = useState<CurrencyRow[]>(initialData)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState<number | null>(null)
  const dragIndex = useRef<number | null>(null)

  function toggleEnabled(currency_id: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.currency_id === currency_id ? { ...r, is_enabled: !r.is_enabled } : r
      )
    )
    setSaved(false)
  }

  function setDecimals(currency_id: string, val: number | null) {
    setRows((prev) =>
      prev.map((r) =>
        r.currency_id === currency_id ? { ...r, decimal_places: val } : r
      )
    )
    setSaved(false)
  }

  function handleDragStart(index: number) {
    dragIndex.current = index
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDragOver(index)
  }

  function handleDrop(index: number) {
    const from = dragIndex.current
    if (from === null || from === index) {
      setDragOver(null)
      dragIndex.current = null
      return
    }
    const next = [...rows]
    const [moved] = next.splice(from, 1)
    next.splice(index, 0, moved)
    setRows(next.map((r, i) => ({ ...r, display_order: i + 1 })))
    setSaved(false)
    setDragOver(null)
    dragIndex.current = null
  }

  function handleDragEnd() {
    setDragOver(null)
    dragIndex.current = null
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const payload = rows.map((r) => ({
        currency_id: r.currency_id,
        is_enabled: r.is_enabled,
        display_order: r.display_order,
        decimal_places: r.decimal_places,
      }))

      const res = await fetch('/api/currencies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Failed to save')
        return
      }

      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  const enabledCount = rows.filter((r) => r.is_enabled).length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-zinc-500 text-sm">
          {enabledCount} of {rows.length} currencies shown on TV
        </p>
        <div className="flex items-center gap-3">
          {saved && <span className="text-green-400 text-sm">Saved</span>}
          {error && <span className="text-red-400 text-sm">{error}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-500 font-medium w-12"></th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Currency</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Decimals on TV</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium w-28">Show on TV</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.currency_id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`border-b border-zinc-800/50 last:border-0 transition-colors ${
                  dragOver === index ? 'bg-purple-950/40' : ''
                } ${!row.is_enabled ? 'opacity-50' : ''}`}
              >
                <td className="px-4 py-3">
                  <div
                    className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300 select-none text-lg leading-none"
                    title="Drag to reorder"
                  >
                    ⠿
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-4 overflow-hidden rounded-sm shrink-0">
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
                      <span className="text-zinc-500 ml-2">{row.currencies.name}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={row.decimal_places ?? row.currencies.default_decimals}
                    onChange={(e) => setDecimals(row.currency_id, Number(e.target.value))}
                    className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-500"
                  >
                    {DECIMAL_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} decimal{d !== 1 ? 's' : ''}{d === row.currencies.default_decimals ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleEnabled(row.currency_id)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      row.is_enabled ? 'bg-purple-600' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        row.is_enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
