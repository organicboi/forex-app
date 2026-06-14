'use client'

import { useState, useRef } from 'react'

export interface ColumnDef {
  key: string
  label: string
  color: string
  visible: boolean
  order: number
  is_builtin: boolean
}

export interface DisplayTemplate {
  id: string
  name: string
  is_default: boolean
  columns: ColumnDef[]
  created_at: string
}

interface Props {
  template: DisplayTemplate | null
  saving: boolean
  onSave: (id: string | null, name: string, columns: ColumnDef[]) => Promise<void>
  onClose: () => void
}

const PRESET_COLORS = [
  '#16a34a', '#dc2626', '#7c3aed', '#ef6c21',
  '#2563eb', '#0891b2', '#ca8a04', '#db2777',
  '#0d9488', '#6366f1',
]

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'buy',      label: 'Buy',      color: '#16a34a', visible: true, order: 0, is_builtin: true },
  { key: 'sell',     label: 'Sell',     color: '#dc2626', visible: true, order: 1, is_builtin: true },
  { key: 'transfer', label: 'Transfer', color: '#7c3aed', visible: true, order: 2, is_builtin: true },
]

export default function TemplateEditor({ template, saving, onSave, onClose }: Props) {
  const [name, setName] = useState(template?.name ?? '')
  const [columns, setColumns] = useState<ColumnDef[]>(
    template ? [...template.columns].sort((a, b) => a.order - b.order) : [...DEFAULT_COLUMNS]
  )
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [error, setError] = useState('')
  const dragIndex = useRef<number | null>(null)

  function toggleVisible(key: string) {
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)))
  }

  function setLabel(key: string, label: string) {
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, label } : c)))
  }

  function setColor(key: string, color: string) {
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, color } : c)))
    setColorPickerFor(null)
  }

  function removeColumn(key: string) {
    setColumns((prev) =>
      prev.filter((c) => c.key !== key).map((c, i) => ({ ...c, order: i }))
    )
  }

  function addColumn() {
    const usedColors = columns.map((c) => c.color)
    const nextColor = PRESET_COLORS.find((c) => !usedColors.includes(c)) ?? PRESET_COLORS[0]
    const key = `custom_${Math.random().toString(36).slice(2, 10)}`
    setColumns((prev) => [
      ...prev,
      { key, label: 'Custom', color: nextColor, visible: true, order: prev.length, is_builtin: false },
    ])
  }

  function handleDragStart(index: number) {
    dragIndex.current = index
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDragOver(index)
  }

  function handleDrop(dropIndex: number) {
    const from = dragIndex.current
    if (from === null || from === dropIndex) {
      setDragOver(null)
      dragIndex.current = null
      return
    }
    const next = [...columns]
    const [moved] = next.splice(from, 1)
    next.splice(dropIndex, 0, moved)
    setColumns(next.map((c, i) => ({ ...c, order: i })))
    dragIndex.current = null
    setDragOver(null)
  }

  function handleDragEnd() {
    setDragOver(null)
    dragIndex.current = null
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Template name is required'); return }
    if (columns.filter((c) => c.visible).length === 0) { setError('At least one column must be visible'); return }
    if (columns.some((c) => !c.label.trim())) { setError('All columns must have a label'); return }
    setError('')
    await onSave(template?.id ?? null, name.trim(), columns)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-white font-semibold text-base">
            {template ? 'Edit Template' : 'New Template'}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
          onClick={() => setColorPickerFor(null)}
        >
          {/* Name */}
          <div>
            <label className="text-zinc-400 text-xs font-medium uppercase tracking-wide block mb-1.5">
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Standard, Cash Board, Full Board"
              maxLength={50}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Columns */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-zinc-400 text-xs font-medium uppercase tracking-wide">
                Columns
              </label>
              <span className="text-zinc-600 text-xs">drag to reorder</span>
            </div>

            {/* Fixed currency row */}
            <div className="flex items-center gap-3 px-3 py-2.5 bg-zinc-800/20 rounded-lg mb-1 opacity-50">
              <span className="text-zinc-700 text-lg leading-none w-4 select-none">⠿</span>
              <span className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-zinc-500 text-sm">Currency</span>
              <span className="text-zinc-700 text-xs">always visible</span>
              <div className="w-[26px]" />
              <div className="w-4" />
            </div>

            {/* Configurable columns */}
            <div className="space-y-1">
              {columns.map((col, index) => (
                <div
                  key={col.key}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                    dragOver === index
                      ? 'bg-purple-950/30 border-purple-700/50'
                      : 'bg-zinc-800/30 border-transparent'
                  }`}
                >
                  <span className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300 select-none text-lg leading-none w-4">
                    ⠿
                  </span>

                  {/* Visibility checkbox */}
                  <button
                    onClick={() => toggleVisible(col.key)}
                    className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      col.visible ? 'bg-purple-600 border-purple-600' : 'border-zinc-600'
                    }`}
                  >
                    {col.visible && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>

                  {/* Label input */}
                  <input
                    type="text"
                    value={col.label}
                    onChange={(e) => setLabel(col.key, e.target.value)}
                    maxLength={30}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-purple-500 min-w-0"
                  />

                  {/* Color picker */}
                  <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setColorPickerFor(colorPickerFor === col.key ? null : col.key)}
                      className="w-6 h-6 rounded border-2 border-zinc-700 hover:border-zinc-400 transition-colors"
                      style={{ backgroundColor: col.color }}
                      title="Change color"
                    />
                    {colorPickerFor === col.key && (
                      <div className="absolute right-0 top-8 z-20 bg-zinc-800 border border-zinc-700 rounded-xl p-2.5 grid grid-cols-5 gap-1.5 shadow-2xl">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setColor(col.key, c)}
                            className={`w-6 h-6 rounded-md border-2 transition-all ${
                              col.color === c ? 'border-white scale-110' : 'border-transparent hover:border-zinc-400'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Delete (custom only) */}
                  {col.is_builtin ? (
                    <div className="w-4 flex-shrink-0" />
                  ) : (
                    <button
                      onClick={() => removeColumn(col.key)}
                      className="flex-shrink-0 text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addColumn}
              className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Custom Column
            </button>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  )
}
