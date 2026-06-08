'use client'

import { useState, useMemo } from 'react'

interface RateRow {
  id: string
  changed_at: string
  currency_code: string
  buy: number | null
  sell: number | null
  transfer: number | null
  source: string
  changed_by_name: string
  branch_name: string | null
}

interface Currency { id: string; code: string }
interface Branch { id: string; name: string }

interface Props {
  initialRows: RateRow[]
  currencies: Currency[]
  branches: Branch[]
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  excel: 'Excel',
  api: 'API',
  system: 'System',
}

export default function RateHistoryReport({ initialRows, currencies, branches }: Props) {
  const [rows, setRows] = useState<RateRow[]>(initialRows)
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [currencyId, setCurrencyId] = useState('')
  const [branchId, setBranchId] = useState('')

  async function applyFilters() {
    setLoading(true)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to + 'T23:59:59Z')
    if (currencyId) params.set('currency_id', currencyId)
    if (branchId) params.set('branch_id', branchId)

    try {
      const res = await fetch(`/api/reports/rates?${params}`)
      if (res.ok) setRows(await res.json())
    } finally {
      setLoading(false)
    }
  }

  function exportCsv() {
    const headers = ['Date/Time', 'Currency', 'Buy', 'Sell', 'Transfer', 'Source', 'Changed By', 'Branch']
    const csvRows = rows.map((r) => [
      new Date(r.changed_at).toISOString(),
      r.currency_code,
      r.buy ?? '',
      r.sell ?? '',
      r.transfer ?? '',
      r.source,
      r.changed_by_name,
      r.branch_name ?? 'Customer-wide',
    ])
    const csv = [headers, ...csvRows].map((row) => row.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rate-history-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = useMemo(() => rows, [rows])

  return (
    <div>
      {/* Filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-zinc-500 text-xs">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-zinc-500 text-xs">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-zinc-500 text-xs">Currency</label>
          <select
            value={currencyId}
            onChange={(e) => setCurrencyId(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="">All</option>
            {currencies.map((c) => (
              <option key={c.id} value={c.id}>{c.code}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-zinc-500 text-xs">Branch</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="">All</option>
            <option value="__null__">Customer-wide</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={applyFilters}
          disabled={loading}
          className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? 'Loading…' : 'Apply'}
        </button>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Export CSV
        </button>
        <span className="text-zinc-600 text-xs self-end pb-1.5">{filtered.length} rows</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No rate changes match the current filters.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Time</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Currency</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium">Buy</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium">Sell</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium">Transfer</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Source</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Changed By</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Branch</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/30">
                  <td className="px-4 py-2.5 text-zinc-400 text-xs font-mono whitespace-nowrap">
                    {new Date(r.changed_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-white font-medium">{r.currency_code}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-zinc-300 font-mono text-xs">
                    {r.buy != null ? r.buy.toFixed(4) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-zinc-300 font-mono text-xs">
                    {r.sell != null ? r.sell.toFixed(4) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-zinc-300 font-mono text-xs">
                    {r.transfer != null ? r.transfer.toFixed(4) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.source === 'manual' ? 'bg-blue-900/40 text-blue-400' :
                      r.source === 'excel' ? 'bg-green-900/40 text-green-400' :
                      r.source === 'api' ? 'bg-yellow-900/40 text-yellow-400' :
                      'bg-zinc-800 text-zinc-500'
                    }`}>
                      {SOURCE_LABELS[r.source] ?? r.source}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400 text-xs">{r.changed_by_name}</td>
                  <td className="px-4 py-2.5 text-zinc-500 text-xs">
                    {r.branch_name ?? <span className="text-zinc-700">Customer-wide</span>}
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
