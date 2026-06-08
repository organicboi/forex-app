'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface BranchSummary {
  id: string
  name: string
}

interface User {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'branch_user'
  is_active: boolean
  created_at: string
  branch_user_assignments: {
    branch_id: string
    branches: { id: string; name: string } | { id: string; name: string }[] | null
  } | null
}

interface Props {
  initialUsers: User[]
  branches: BranchSummary[]
  currentUserId: string
}

export default function UserManager({ initialUsers, branches, currentUserId }: Props) {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    branch_id: '',
  })

  function getBranchName(user: User): string {
    const assignment = user.branch_user_assignments
    if (!assignment) return '—'
    const br = Array.isArray(assignment.branches) ? assignment.branches[0] : assignment.branches
    return br?.name ?? '—'
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          branch_id: form.branch_id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateError(data.error ?? 'Failed to create user')
        return
      }
      setForm({ email: '', password: '', full_name: '', branch_id: '' })
      setShowCreate(false)
      router.refresh()
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(userId: string, current: boolean) {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current }),
    })
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: !current } : u))
      )
    }
  }

  async function handleDelete(userId: string) {
    if (!window.confirm('Delete this user? This cannot be undone.')) return
    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      router.refresh()
    }
  }

  async function handleBranchChange(userId: string, branchId: string) {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: branchId || null }),
    })
    if (res.ok) {
      router.refresh()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Users</h1>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Add User
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
          <h2 className="text-white font-medium text-sm mb-4">New Branch User</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Full Name</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="e.g. Ahmed Al-Rashid"
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="branch@example.com"
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
                required
              />
            </div>
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Password *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min 8 characters"
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="block text-zinc-400 text-xs mb-1.5">Assign to Branch</label>
              <select
                value={form.branch_id}
                onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
              >
                <option value="">— No assignment —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
          {createError && <p className="text-red-400 text-sm mt-3">{createError}</p>}
          <div className="flex items-center gap-2 mt-4">
            <button
              type="submit"
              disabled={creating}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {creating ? 'Creating…' : 'Create User'}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setCreateError('') }}
              className="text-zinc-400 hover:text-zinc-200 text-sm px-3 py-2 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">User</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Role</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Branch</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-zinc-800/50 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">
                    {user.full_name || <span className="text-zinc-600">—</span>}
                    {user.id === currentUserId && (
                      <span className="ml-2 text-xs text-zinc-600">(you)</span>
                    )}
                  </div>
                  <div className="text-zinc-500 text-xs mt-0.5">{user.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                      user.role === 'admin'
                        ? 'bg-purple-900/40 text-purple-300'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {user.role === 'admin' ? 'Admin' : 'Branch User'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {user.role === 'branch_user' ? (
                    <select
                      defaultValue={user.branch_user_assignments?.branch_id ?? ''}
                      onChange={(e) => handleBranchChange(user.id, e.target.value)}
                      className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-purple-500"
                    >
                      <option value="">— Unassigned —</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-zinc-600 text-xs">All branches</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {user.id !== currentUserId ? (
                    <button
                      onClick={() => toggleActive(user.id, user.is_active)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        user.is_active ? 'bg-green-700' : 'bg-zinc-700'
                      }`}
                      title={user.is_active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          user.is_active ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  ) : (
                    <span className="text-zinc-600 text-xs">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {user.id !== currentUserId && (
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-red-500 hover:text-red-400 text-xs transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
