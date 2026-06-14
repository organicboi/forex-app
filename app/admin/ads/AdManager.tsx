'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'

interface Ad {
  id: string
  file_url: string
  file_type: 'image' | 'video'
  duration_seconds: number
  display_order: number
  is_active: boolean
  file_size_bytes: number
  original_name: string | null
  branch_id: string | null
}

interface BranchOption {
  id: string
  name: string
}

interface Props {
  initialAds: Ad[]
  branches: BranchOption[]
  storageMb: { used: number; limit: number }
}

type TypeFilter = 'all' | 'image' | 'video'

const ALLOWED_MIME = 'image/jpeg,image/jpg,image/png,image/webp,image/gif,video/mp4,video/webm'

export default function AdManager({ initialAds, branches, storageMb }: Props) {
  const [ads, setAds] = useState<Ad[]>(initialAds)
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [duration, setDuration] = useState(10)
  const fileRef = useRef<HTMLInputElement>(null)

  // Inline duration edit
  const [editingDurationId, setEditingDurationId] = useState<string | null>(null)
  const [editingDurationValue, setEditingDurationValue] = useState(10)

  // Preview overlay
  const [previewAd, setPreviewAd] = useState<Ad | null>(null)

  const scopeFiltered = ads.filter((a) =>
    selectedBranch ? a.branch_id === selectedBranch : a.branch_id === null
  )

  const displayedAds = typeFilter === 'all'
    ? scopeFiltered
    : scopeFiltered.filter((a) => a.file_type === typeFilter)

  async function handleUpload(file: File) {
    setUploading(true)
    setUploadError('')
    setUploadProgress('Preparing upload…')

    try {
      const urlRes = await fetch('/api/ads/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type,
          file_size_bytes: file.size,
        }),
      })
      const urlData = await urlRes.json()
      if (!urlRes.ok) {
        setUploadError(urlData.error ?? 'Failed to get upload URL')
        return
      }

      setUploadProgress('Uploading file…')
      const uploadRes = await fetch(urlData.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!uploadRes.ok) {
        setUploadError('Upload to storage failed')
        return
      }

      setUploadProgress('Saving…')
      const fileType = file.type.startsWith('video/') ? 'video' : 'image'
      const metaRes = await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: urlData.key,
          file_type: fileType,
          duration_seconds: duration,
          original_name: file.name,
          file_size_bytes: file.size,
          branch_id: selectedBranch || null,
        }),
      })
      const metaData = await metaRes.json()
      if (!metaRes.ok) {
        setUploadError(metaData.error ?? 'Failed to save ad metadata')
        return
      }

      setAds((prev) => [...prev, metaData])
      if (fileRef.current) fileRef.current.value = ''
      setUploadProgress('')
    } catch {
      setUploadError('Upload failed — check your connection')
    } finally {
      setUploading(false)
      if (!uploadError) setUploadProgress('')
    }
  }

  async function toggleActive(id: string, current: boolean) {
    const res = await fetch(`/api/ads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current }),
    })
    if (res.ok) {
      setAds((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_active: !current } : a))
      )
    }
  }

  async function handleDelete(id: string, fileName: string | null) {
    if (!window.confirm(`Delete "${fileName ?? 'this ad'}"? This cannot be undone.`)) return
    const res = await fetch(`/api/ads/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAds((prev) => prev.filter((a) => a.id !== id))
    }
  }

  async function commitDurationEdit(id: string) {
    const value = Math.max(1, Math.min(300, editingDurationValue))
    setEditingDurationId(null)
    const res = await fetch(`/api/ads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration_seconds: value }),
    })
    if (res.ok) {
      setAds((prev) =>
        prev.map((a) => (a.id === id ? { ...a, duration_seconds: value } : a))
      )
    }
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const storagePercent = storageMb.limit > 0
    ? Math.min(100, (storageMb.used / storageMb.limit) * 100)
    : 0

  const imageCount = scopeFiltered.filter((a) => a.file_type === 'image').length
  const videoCount = scopeFiltered.filter((a) => a.file_type === 'video').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Ads</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="">Customer-wide</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Storage bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
          <span>Storage</span>
          <span>{storageMb.used.toFixed(1)} MB / {storageMb.limit} MB</span>
        </div>
        <div className="w-full bg-zinc-800 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${storagePercent > 85 ? 'bg-red-500' : 'bg-purple-500'}`}
            style={{ width: `${storagePercent}%` }}
          />
        </div>
      </div>

      {/* Upload section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-5">
        <h2 className="text-white font-medium text-sm mb-3">Upload New Ad</h2>
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-zinc-500 text-xs mb-1.5">Duration (seconds)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
              min={1}
              max={300}
              className="w-24 bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
            />
          </div>
          <label className={`cursor-pointer ${uploading ? 'pointer-events-none' : ''}`}>
            <input
              ref={fileRef}
              type="file"
              accept={ALLOWED_MIME}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleUpload(f)
              }}
            />
            <span className="inline-block bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              {uploading ? uploadProgress || 'Uploading…' : 'Choose File'}
            </span>
          </label>
        </div>
        <p className="text-zinc-600 text-xs mt-2">
          Accepted: JPEG, PNG, WebP, GIF, MP4, WebM · Max 100 MB
          {selectedBranch
            ? ` · Uploading to: ${branches.find((b) => b.id === selectedBranch)?.name}`
            : ' · Uploading as customer-wide'}
        </p>
        <p className="text-zinc-600 text-xs mt-1">
          Tip: To assign specific ads to a screen, open <a href="/admin/branches" className="text-purple-400 hover:text-purple-300">Branches</a> → select a branch → click the ⚙ icon on a screen.
        </p>
        {uploadError && (
          <p className="text-red-400 text-sm mt-2">{uploadError}</p>
        )}
      </div>

      {/* Type filter tabs */}
      {scopeFiltered.length > 0 && (
        <div className="flex items-center gap-1 mb-4">
          {([
            { key: 'all', label: `All (${scopeFiltered.length})` },
            { key: 'image', label: `Images (${imageCount})` },
            { key: 'video', label: `Videos (${videoCount})` },
          ] as { key: TypeFilter; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                typeFilter === key
                  ? 'bg-purple-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Ad list */}
      {displayedAds.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No ads yet.</p>
          <p className="text-zinc-600 text-xs mt-1">Upload an image or video above to get started.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-zinc-500 font-medium w-16">Preview</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">File</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium w-28">Duration</th>
                <th className="text-right px-4 py-3 text-zinc-500 font-medium w-20">Size</th>
                <th className="text-center px-4 py-3 text-zinc-500 font-medium w-20">Active</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {displayedAds.map((ad) => (
                <tr key={ad.id} className="border-b border-zinc-800/50 last:border-0">
                  {/* Thumbnail */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setPreviewAd(ad)}
                      className="group relative w-12 h-8 bg-zinc-800 rounded overflow-hidden block"
                      title="Preview"
                    >
                      {ad.file_type === 'image' ? (
                        <Image
                          src={ad.file_url}
                          alt={ad.original_name ?? 'Ad'}
                          width={48}
                          height={32}
                          unoptimized
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-zinc-400 text-xs">▶</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-xs">👁</span>
                      </div>
                    </button>
                  </td>

                  {/* File name */}
                  <td className="px-4 py-3">
                    <div className="text-zinc-300 text-xs truncate max-w-xs">
                      {ad.original_name ?? ad.file_url.split('/').pop()}
                    </div>
                    <div className="text-zinc-600 text-xs mt-0.5 capitalize">{ad.file_type}</div>
                  </td>

                  {/* Duration — inline editable */}
                  <td className="px-4 py-3 text-right">
                    {editingDurationId === ad.id ? (
                      <input
                        type="number"
                        value={editingDurationValue}
                        min={1}
                        max={300}
                        autoFocus
                        onChange={(e) => setEditingDurationValue(Number(e.target.value))}
                        onBlur={() => commitDurationEdit(ad.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitDurationEdit(ad.id)
                          if (e.key === 'Escape') setEditingDurationId(null)
                        }}
                        className="w-16 bg-zinc-800 border border-purple-600 text-white text-xs rounded px-2 py-0.5 text-right focus:outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setEditingDurationId(ad.id)
                          setEditingDurationValue(ad.duration_seconds)
                        }}
                        className="text-zinc-400 text-xs hover:text-purple-300 transition-colors"
                        title="Click to edit duration"
                      >
                        {ad.duration_seconds}s
                      </button>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-zinc-500 text-xs">{formatBytes(ad.file_size_bytes)}</td>

                  {/* Active toggle */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(ad.id, ad.is_active)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        ad.is_active ? 'bg-purple-600' : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          ad.is_active ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </td>

                  {/* Delete */}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(ad.id, ad.original_name)}
                      className="text-red-500 hover:text-red-400 text-xs transition-colors"
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

      {/* Preview overlay */}
      {previewAd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setPreviewAd(null)}
        >
          <div
            className="relative max-w-3xl max-h-[80vh] rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {previewAd.file_type === 'video' ? (
              <video
                src={previewAd.file_url}
                autoPlay
                controls
                className="max-w-full max-h-[75vh] object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewAd.file_url}
                alt={previewAd.original_name ?? 'Preview'}
                className="max-w-full max-h-[75vh] object-contain"
              />
            )}
            <div className="absolute top-3 right-3">
              <button
                onClick={() => setPreviewAd(null)}
                className="bg-black/60 hover:bg-black/80 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-4 py-2 text-xs text-zinc-300">
              {previewAd.original_name ?? 'Ad'} · {previewAd.file_type} · {previewAd.duration_seconds}s · {formatBytes(previewAd.file_size_bytes)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
