'use client'

import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/distributor/logout', { method: 'POST' })
    router.push('/distributor')
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full px-3 py-2 text-left text-zinc-500 hover:text-white text-sm rounded-lg hover:bg-zinc-800 transition-colors"
    >
      Sign out
    </button>
  )
}
