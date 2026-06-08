'use client'

import { useState } from 'react'

interface Key {
  id: string
  customer_id: string
  customer_name: string
  label: string | null
  issued_at: string
  expires_at: string | null
  redeemed_at: string | null
  redeemed_by: string | null
  is_revoked: boolean
}

export default function KeyManager({ initialKeys }: { initialKeys: Key[] }) {
  const [keys, setKeys] = useState(initialKeys)

  async function revokeKey(id: string) {
    const res = await fetch(`/api/distributor/keys?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_revoked: true }),
    })
    if (res.ok) {
      setKeys((prev) => prev.map((k) => k.id === id ? { ...k, is_revoked: true } : k))
    }
  }

  if (keys.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
        <p className="text-zinc-500 text-sm">No keys issued yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left px-4 py-3 text-zinc-500 font-medium">Customer</th>
            <th className="text-left px-4 py-3 text-zinc-500 font-medium">Label</th>
            <th className="text-left px-4 py-3 text-zinc-500 font-medium">Issued</th>
            <th className="text-left px-4 py-3 text-zinc-500 font-medium">Expires</th>
            <th className="text-left px-4 py-3 text-zinc-500 font-medium">Redeemed</th>
            <th className="text-left px-4 py-3 text-zinc-500 font-medium">Status</th>
            <th className="w-20 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.id} className="border-b border-zinc-800/40 last:border-0">
              <td className="px-4 py-2.5 text-zinc-300 text-xs font-medium">{k.customer_name}</td>
              <td className="px-4 py-2.5 text-zinc-500 text-xs">{k.label ?? '—'}</td>
              <td className="px-4 py-2.5 text-zinc-500 text-xs">{new Date(k.issued_at).toLocaleDateString()}</td>
              <td className="px-4 py-2.5 text-zinc-500 text-xs">
                {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : '—'}
              </td>
              <td className="px-4 py-2.5 text-zinc-500 text-xs">
                {k.redeemed_at ? new Date(k.redeemed_at).toLocaleDateString() : '—'}
              </td>
              <td className="px-4 py-2.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  k.is_revoked ? 'bg-red-900/40 text-red-400' :
                  k.redeemed_at ? 'bg-zinc-800 text-zinc-500' :
                  'bg-green-900/40 text-green-400'
                }`}>
                  {k.is_revoked ? 'Revoked' : k.redeemed_at ? 'Used' : 'Active'}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right">
                {!k.is_revoked && (
                  <button
                    onClick={() => revokeKey(k.id)}
                    className="text-xs text-red-500 hover:text-red-300 transition-colors"
                  >
                    Revoke
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
