'use client'

import { useState, useRef } from 'react'
import TemplateEditor, { type ColumnDef, type DisplayTemplate } from './TemplateEditor'
import { useToast } from '../ToastContext'

interface ImportPreviewRow {
  row_index: number
  code: string
  currency_id: string | null
  values: Record<string, number>
  error?: string
}

interface ImportState {
  template: DisplayTemplate
  preview: ImportPreviewRow[] | null
  previewColumns: { key: string; label: string }[]
  validCount: number
  loading: boolean
  importing: boolean
  done: number | null
  error: string
}

interface Props {
  initialTemplates: DisplayTemplate[]
}

export default function TemplateManager({ initialTemplates }: Props) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<DisplayTemplate[]>(initialTemplates)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<DisplayTemplate | null>(null)
  const [editorSaving, setEditorSaving] = useState(false)
  const [importState, setImportState] = useState<ImportState | null>(null)
  const [settingDefault, setSettingDefault] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [actionError, setActionError] = useState<Record<string, string>>({})
  const importFileRef = useRef<HTMLInputElement>(null)

  function openEditor(template: DisplayTemplate | null) {
    setEditingTemplate(template)
    setEditorOpen(true)
  }

  function closeEditor() {
    setEditorOpen(false)
    setEditingTemplate(null)
  }

  async function handleSaveTemplate(id: string | null, name: string, columns: ColumnDef[]) {
    setEditorSaving(true)
    try {
      if (id) {
        const res = await fetch(`/api/templates/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, columns }),
        })
        const data = await res.json()
        if (!res.ok) { toast(data.error ?? 'Failed to save', 'error'); return }
        setTemplates((prev) => prev.map((t) => (t.id === id ? data : t)))
      } else {
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, columns }),
        })
        const data = await res.json()
        if (!res.ok) { toast(data.error ?? 'Failed to create', 'error'); return }
        setTemplates((prev) => [...prev, data])
      }
      closeEditor()
      toast('Template saved')
    } finally {
      setEditorSaving(false)
    }
  }

  async function handleSetDefault(templateId: string) {
    setSettingDefault(templateId)
    setActionError((prev) => ({ ...prev, [templateId]: '' }))
    try {
      const res = await fetch(`/api/templates/${templateId}/set-default`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setActionError((prev) => ({ ...prev, [templateId]: data.error ?? 'Failed' })); return }
      setTemplates((prev) => prev.map((t) => ({ ...t, is_default: t.id === templateId })))
      toast('Default template updated')
    } finally {
      setSettingDefault(null)
    }
  }

  async function handleDelete(templateId: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return
    setDeleting(templateId)
    try {
      const res = await fetch(`/api/templates/${templateId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setActionError((prev) => ({ ...prev, [templateId]: data.error ?? 'Failed to delete' })); return }
      setTemplates((prev) => prev.filter((t) => t.id !== templateId))
      toast('Template deleted')
    } finally {
      setDeleting(null)
    }
  }

  async function handleDuplicate(template: DisplayTemplate) {
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${template.name} (copy)`,
        columns: template.columns,
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast(data.error ?? 'Failed to duplicate', 'error'); return }
    setTemplates((prev) => [...prev, data])
    toast('Template duplicated')
  }

  function handleDownloadExcel(template: DisplayTemplate) {
    window.location.href = `/api/templates/${template.id}/excel`
  }

  function openImport(template: DisplayTemplate) {
    setImportState({
      template,
      preview: null,
      previewColumns: [],
      validCount: 0,
      loading: false,
      importing: false,
      done: null,
      error: '',
    })
  }

  async function handleImportFile(file: File) {
    if (!importState) return
    setImportState((s) => s ? { ...s, loading: true, error: '', preview: null, done: null } : s)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/templates/${importState.template.id}/excel`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setImportState((s) => s ? { ...s, error: data.error ?? 'Failed to parse' } : s); return }
      setImportState((s) => s ? {
        ...s,
        preview: data.preview,
        previewColumns: data.columns ?? [],
        validCount: data.valid_count,
      } : s)
    } catch {
      setImportState((s) => s ? { ...s, error: 'Upload failed' } : s)
    } finally {
      setImportState((s) => s ? { ...s, loading: false } : s)
    }
  }

  async function handleCommitImport() {
    if (!importState?.preview) return
    const validRows = importState.preview.filter((r) => !r.error)
    setImportState((s) => s ? { ...s, importing: true, error: '' } : s)
    try {
      const res = await fetch(`/api/templates/${importState.template.id}/excel?action=commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: validRows }),
      })
      const data = await res.json()
      if (!res.ok) { setImportState((s) => s ? { ...s, error: data.error ?? 'Import failed' } : s); return }
      setImportState((s) => s ? { ...s, done: data.imported, preview: null } : s)
      if (importFileRef.current) importFileRef.current.value = ''
    } catch {
      setImportState((s) => s ? { ...s, error: 'Import failed' } : s)
    } finally {
      setImportState((s) => s ? { ...s, importing: false } : s)
    }
  }

  const visibleColumns = (t: DisplayTemplate) =>
    t.columns.filter((c) => c.visible).sort((a, b) => a.order - b.order)

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-zinc-500 text-sm">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => openEditor(null)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Template
        </button>
      </div>

      {/* Template cards */}
      {templates.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No templates yet.</p>
          <p className="text-zinc-600 text-xs mt-2">Create one to configure your TV display columns.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-white font-semibold text-sm">{template.name}</span>
                    {template.is_default && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-950 text-purple-300 border border-purple-800">
                        Default
                      </span>
                    )}
                  </div>

                  {/* Column pills */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                    {/* Currency is always first */}
                    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-800 rounded-full px-2.5 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                      Currency
                    </span>
                    {visibleColumns(template).map((col) => (
                      <span
                        key={col.key}
                        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 bg-zinc-800 rounded-full px-2.5 py-1"
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.color }} />
                        {col.label}
                      </span>
                    ))}
                    {template.columns.filter((c) => !c.visible).length > 0 && (
                      <span className="text-xs text-zinc-600">
                        +{template.columns.filter((c) => !c.visible).length} hidden
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action row */}
              <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-zinc-800">
                <button
                  onClick={() => handleDownloadExcel(template)}
                  className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                  title="Download Excel template"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download
                </button>

                <button
                  onClick={() => openImport(template)}
                  className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                  title="Import Excel file"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Import
                </button>

                <button
                  onClick={() => openEditor(template)}
                  className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                  </svg>
                  Edit
                </button>

                <button
                  onClick={() => handleDuplicate(template)}
                  className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                  title="Duplicate"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                  </svg>
                  Duplicate
                </button>

                {!template.is_default && (
                  <button
                    onClick={() => handleSetDefault(template.id)}
                    disabled={settingDefault === template.id}
                    className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-purple-300 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-purple-950/50 transition-colors disabled:opacity-40"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                    {settingDefault === template.id ? 'Setting…' : 'Set Default'}
                  </button>
                )}

                {!template.is_default && (
                  <button
                    onClick={() => handleDelete(template.id)}
                    disabled={deleting === template.id}
                    className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-red-400 text-xs px-3 py-1.5 rounded-lg hover:bg-red-950/20 transition-colors disabled:opacity-40 ml-auto"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    {deleting === template.id ? 'Deleting…' : 'Delete'}
                  </button>
                )}

                {actionError[template.id] && (
                  <span className="text-red-400 text-xs ml-2">{actionError[template.id]}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Template editor modal */}
      {editorOpen && (
        <TemplateEditor
          template={editingTemplate}
          saving={editorSaving}
          onSave={handleSaveTemplate}
          onClose={closeEditor}
        />
      )}

      {/* Import modal */}
      {importState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setImportState(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Import header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div>
                <h2 className="text-white font-semibold text-base">Import Rates</h2>
                <p className="text-zinc-500 text-xs mt-0.5">
                  Template: <span className="text-zinc-400">{importState.template.name}</span>
                </p>
              </div>
              <button
                onClick={() => setImportState(null)}
                className="text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Import body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* File picker */}
              <div className="flex items-center gap-3 mb-4">
                <label className={`cursor-pointer ${importState.loading ? 'pointer-events-none' : ''}`}>
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleImportFile(f)
                    }}
                  />
                  <span className="inline-block bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm px-4 py-2 rounded-lg border border-zinc-700 transition-colors select-none">
                    {importState.loading ? 'Parsing…' : importState.preview ? 'Replace File' : 'Choose File'}
                  </span>
                </label>
                <p className="text-zinc-600 text-xs">
                  Upload <span className="font-mono text-zinc-500">.xlsx</span> matching the{' '}
                  <button
                    onClick={() => handleDownloadExcel(importState.template)}
                    className="text-purple-400 hover:underline"
                  >
                    {importState.template.name}
                  </button>{' '}
                  template
                </p>
              </div>

              {importState.error && (
                <div className="mb-4 text-red-400 text-sm bg-red-950/30 border border-red-800/50 rounded-lg px-3 py-2">
                  {importState.error}
                </div>
              )}

              {importState.done !== null && !importState.preview && (
                <div className="mb-4 text-green-400 text-sm bg-green-950/30 border border-green-800/50 rounded-lg px-3 py-2">
                  Successfully imported {importState.done} rate{importState.done !== 1 ? 's' : ''}. TV screens update within 30 seconds.
                </div>
              )}

              {importState.preview && (
                <div>
                  <div className="border border-zinc-800 rounded-lg overflow-hidden mb-4">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-800/50">
                          <th className="text-left px-3 py-2 text-zinc-500 font-medium w-12">Row</th>
                          <th className="text-left px-3 py-2 text-zinc-500 font-medium w-16">Code</th>
                          {importState.previewColumns.map((col) => (
                            <th key={col.key} className="text-right px-3 py-2 text-zinc-500 font-medium">
                              {col.label}
                            </th>
                          ))}
                          <th className="text-left px-3 py-2 text-zinc-500 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importState.preview.map((row) => (
                          <tr
                            key={row.row_index}
                            className={`border-b border-zinc-800/50 last:border-0 ${row.error ? 'bg-red-950/10' : ''}`}
                          >
                            <td className="px-3 py-2 text-zinc-600">{row.row_index}</td>
                            <td className="px-3 py-2 font-mono font-semibold text-white">{row.code}</td>
                            {importState.previewColumns.map((col) => (
                              <td key={col.key} className="px-3 py-2 text-right font-mono text-zinc-300">
                                {row.values[col.key] ?? 0}
                              </td>
                            ))}
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
                      {importState.validCount} of {importState.preview.length} row{importState.preview.length !== 1 ? 's' : ''} will be imported
                      {importState.preview.length - importState.validCount > 0 && (
                        <span className="text-amber-500 ml-2">
                          · {importState.preview.length - importState.validCount} skipped
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setImportState((s) => s ? { ...s, preview: null } : s)}
                        className="text-zinc-400 hover:text-zinc-200 text-sm px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCommitImport}
                        disabled={importState.importing || importState.validCount === 0}
                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                      >
                        {importState.importing
                          ? 'Importing…'
                          : `Import ${importState.validCount} rate${importState.validCount !== 1 ? 's' : ''}`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
