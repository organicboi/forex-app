'use client'

import { useState } from 'react'
import { useToast } from '../ToastContext'

interface TickerMessage {
  id: string
  message: string
  display_order: number
  is_active: boolean
  branch_id: string | null
}

interface Props {
  initialMessages: TickerMessage[]
}

export default function TickerManager({ initialMessages }: Props) {
  const { toast } = useToast()
  const [messages, setMessages] = useState<TickerMessage[]>(initialMessages)
  const [newText, setNewText] = useState('')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newText.trim()) return
    setAdding(true)
    setError('')
    try {
      const res = await fetch('/api/ticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newText }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to add'); return }
      setMessages((prev) => [...prev, data])
      setNewText('')
      toast('Message added')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/ticker?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== id))
      toast('Message deleted')
    } else {
      toast('Failed to delete message', 'error')
    }
  }

  async function toggleActive(id: string, current: boolean) {
    const res = await fetch('/api/ticker', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id, is_active: !current }]),
    })
    if (res.ok) {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, is_active: !current } : m))
      )
    } else {
      toast('Failed to update message', 'error')
    }
  }

  function moveUp(index: number) {
    if (index === 0) return
    const next = [...messages]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    setMessages(next.map((m, i) => ({ ...m, display_order: i + 1 })))
    setSaved(false)
  }

  function moveDown(index: number) {
    if (index === messages.length - 1) return
    const next = [...messages]
    ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
    setMessages(next.map((m, i) => ({ ...m, display_order: i + 1 })))
    setSaved(false)
  }

  async function saveOrder() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/ticker', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages.map((m) => ({ id: m.id, display_order: m.display_order }))),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save order')
        return
      }
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return
    const res = await fetch('/api/ticker', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id, message: editText }]),
    })
    if (res.ok) {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, message: editText } : m))
      )
      setEditingId(null)
      toast('Message updated')
    } else {
      toast('Failed to update message', 'error')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-end gap-3 mb-6">
        {saved && <span className="text-green-400 text-sm">Order saved</span>}
        {error && <span className="text-red-400 text-sm">{error}</span>}
        <button
          onClick={saveOrder}
          disabled={saving}
          className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save Order'}
        </button>
      </div>

      {/* Add new message */}
      <form onSubmit={handleAdd} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-5">
        <h2 className="text-white font-medium text-sm mb-3">Add Message</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="e.g. Rates updated every 15 minutes"
            maxLength={200}
            className="flex-1 bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={adding || !newText.trim()}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>

      {messages.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No ticker messages yet.</p>
          <p className="text-zinc-600 text-xs mt-1">Add messages above to display in the TV footer.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-zinc-500 font-medium w-12">Order</th>
                <th className="text-left px-4 py-3 text-zinc-500 font-medium">Message</th>
                <th className="text-center px-4 py-3 text-zinc-500 font-medium w-20">Active</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {messages.map((msg, index) => (
                <tr
                  key={msg.id}
                  className={`border-b border-zinc-800/50 last:border-0 ${!msg.is_active ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed leading-none"
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveDown(index)}
                        disabled={index === messages.length - 1}
                        className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed leading-none"
                        title="Move down"
                      >
                        ▼
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === msg.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="flex-1 bg-zinc-800 border border-purple-500 text-white text-sm rounded-lg px-2 py-1 focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(msg.id)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                        />
                        <button onClick={() => saveEdit(msg.id)} className="text-green-400 text-xs">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-zinc-500 text-xs">Cancel</button>
                      </div>
                    ) : (
                      <span
                        className="text-zinc-200 cursor-pointer hover:text-white"
                        onDoubleClick={() => { setEditingId(msg.id); setEditText(msg.message) }}
                        title="Double-click to edit"
                      >
                        {msg.message}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(msg.id, msg.is_active)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        msg.is_active ? 'bg-purple-600' : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          msg.is_active ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(msg.id)}
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
      <p className="text-zinc-600 text-xs mt-3">
        Double-click a message to edit it. Use ▲▼ to reorder, then &quot;Save Order&quot;.
      </p>
    </div>
  )
}
