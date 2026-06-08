'use client'

import { useState, useRef } from 'react'

interface PreviewRow {
  row_index: number
  code: string
  buy: number
  sell: number
  transfer: number
  currency_id: string | null
  error?: string
}

export default function ExcelImport() {
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [validCount, setValidCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState<number | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError('')
    setPreview(null)
    setDone(null)
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/rates/excel', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to parse file')
        return
      }
      setPreview(data.preview)
      setValidCount(data.valid_count)
    } catch {
      setError('Upload failed — check your connection')
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    if (!preview) return
    const validRows = preview.filter((r) => !r.error)
    const errorRows = preview.filter((r) => !!r.error)

    setImporting(true)
    setError('')
    try {
      const res = await fetch('/api/rates/excel?action=commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: validRows.map((r) => ({
            currency_id: r.currency_id,
            buy: r.buy,
            sell: r.sell,
            transfer: r.transfer,
          })),
          rows_total: preview.length,
          rows_failed: errorRows.length,
          error_summary: errorRows.map((r) => ({
            row: r.row_index,
            currency_code: r.code,
            error: r.error,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Import failed')
        return
      }
      setDone(data.imported)
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch {
      setError('Import failed — check your connection')
    } finally {
      setImporting(false)
    }
  }

  function handleCancel() {
    setPreview(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-white font-medium text-sm">Import Rates from Excel</h2>
          <p className="text-zinc-500 text-xs mt-0.5">
            Upload <span className="font-mono text-zinc-400">.xlsx</span> with columns:{' '}
            <span className="font-mono text-zinc-400">Code, Buy, Sell, Transfer</span>
          </p>
        </div>
        <label className={`cursor-pointer ${loading ? 'pointer-events-none' : ''}`}>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
          <span className="inline-block bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm px-4 py-2 rounded-lg transition-colors border border-zinc-700 select-none">
            {loading ? 'Parsing…' : preview ? 'Replace File' : 'Choose File'}
          </span>
        </label>
      </div>

      {error && (
        <div className="mt-3 text-red-400 text-sm bg-red-950/30 border border-red-800/50 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {done !== null && !preview && (
        <div className="mt-3 text-green-400 text-sm bg-green-950/30 border border-green-800/50 rounded-lg px-3 py-2">
          Successfully imported {done} rate{done !== 1 ? 's' : ''}. TV screens will update within 30 seconds.
        </div>
      )}

      {preview && (
        <div className="mt-4">
          <div className="border border-zinc-800 rounded-lg overflow-hidden mb-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-800/50">
                  <th className="text-left px-3 py-2 text-zinc-500 font-medium w-16">Row</th>
                  <th className="text-left px-3 py-2 text-zinc-500 font-medium w-20">Code</th>
                  <th className="text-right px-3 py-2 text-zinc-500 font-medium">Buy</th>
                  <th className="text-right px-3 py-2 text-zinc-500 font-medium">Sell</th>
                  <th className="text-right px-3 py-2 text-zinc-500 font-medium">Transfer</th>
                  <th className="text-left px-3 py-2 text-zinc-500 font-medium w-48">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr
                    key={row.row_index}
                    className={`border-b border-zinc-800/50 last:border-0 ${
                      row.error ? 'bg-red-950/10' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-zinc-600">{row.row_index}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-white">{row.code}</td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-300">{row.buy}</td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-300">{row.sell}</td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-300">{row.transfer}</td>
                    <td className="px-3 py-2">
                      {row.error ? (
                        <span className="text-red-400">{row.error}</span>
                      ) : (
                        <span className="text-green-400">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-zinc-500 text-xs">
              {validCount} of {preview.length} row{preview.length !== 1 ? 's' : ''} will be imported
              {preview.length - validCount > 0 && (
                <span className="text-amber-500 ml-2">
                  · {preview.length - validCount} skipped (unknown/disabled currencies)
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancel}
                className="text-zinc-400 hover:text-zinc-200 text-sm px-3 py-1.5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
              >
                {importing ? 'Importing…' : `Import ${validCount} rate${validCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
