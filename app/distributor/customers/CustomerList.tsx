'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Customer {
  id: string
  name: string
  is_active: boolean
  plan_expires_at: string
  is_expired: boolean
  plan_name: string
  max_branches: number
  branch_count: number
  storage_used_mb: number
  storage_limit_mb: number
}

export default function CustomerList({ initialCustomers }: { initialCustomers: Customer[] }) {
  const [customers, setCustomers] = useState(initialCustomers)

  async function toggleActive(id: string, current: boolean) {
    const res = await fetch(`/api/distributor/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current }),
    })
    if (res.ok) {
      setCustomers((prev) =>
        prev.map((c) => c.id === id ? { ...c, is_active: !current } : c)
      )
    }
  }

  if (customers.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
        <p className="text-zinc-500 text-sm">No customers yet.</p>
        <p className="text-zinc-600 text-xs mt-2">
          <Link href="/distributor/customers/new" className="text-purple-400 hover:underline">Create your first customer</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left px-4 py-3 text-zinc-500 font-medium">Name</th>
            <th className="text-left px-4 py-3 text-zinc-500 font-medium">Plan</th>
            <th className="text-left px-4 py-3 text-zinc-500 font-medium">Expires</th>
            <th className="text-left px-4 py-3 text-zinc-500 font-medium">Branches</th>
            <th className="text-left px-4 py-3 text-zinc-500 font-medium">Storage</th>
            <th className="text-left px-4 py-3 text-zinc-500 font-medium">Status</th>
            <th className="w-10 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => {
            const storagePct = c.storage_limit_mb > 0
              ? Math.min(100, (c.storage_used_mb / c.storage_limit_mb) * 100)
              : 0
            const expiresIn = Math.round((new Date(c.plan_expires_at).getTime() - Date.now()) / (86400000))
            return (
              <tr key={c.id} className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/20">
                <td className="px-4 py-3">
                  <Link href={`/distributor/customers/${c.id}`} className="text-white hover:text-purple-400 font-medium">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{c.plan_name}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${c.is_expired ? 'text-red-400' : expiresIn < 30 ? 'text-yellow-400' : 'text-zinc-400'}`}>
                    {c.is_expired ? 'Expired' : `${expiresIn}d`}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-400 text-xs">
                  {c.branch_count} / {c.max_branches}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${storagePct > 90 ? 'bg-red-500' : storagePct > 70 ? 'bg-yellow-500' : 'bg-purple-500'}`}
                        style={{ width: `${storagePct}%` }}
                      />
                    </div>
                    <span className="text-zinc-600 text-xs">{c.storage_used_mb.toFixed(0)} MB</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleActive(c.id, c.is_active)}
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors ${
                      c.is_active
                        ? 'bg-green-900/40 text-green-400 hover:bg-red-900/40 hover:text-red-400'
                        : 'bg-zinc-800 text-zinc-500 hover:bg-green-900/40 hover:text-green-400'
                    }`}
                  >
                    {c.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/distributor/customers/${c.id}`} className="text-zinc-600 hover:text-white text-xs">
                    →
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
