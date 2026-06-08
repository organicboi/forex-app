import Link from 'next/link'
import { requireDistributor } from '@/lib/distributor-auth'
import LogoutButton from './LogoutButton'

const NAV = [
  { href: '/distributor/customers', label: 'Customers' },
  { href: '/distributor/plans', label: 'Plans' },
  { href: '/distributor/keys', label: 'Keys' },
  { href: '/distributor/usage', label: 'Usage' },
]

export default async function DistributorLayout({ children }: { children: React.ReactNode }) {
  let authed = false
  try {
    await requireDistributor()
    authed = true
  } catch {
    // Not authenticated — login page renders without sidebar
  }

  if (!authed) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-zinc-800 flex flex-col">
        <div className="px-5 py-5 border-b border-zinc-800">
          <div className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-0.5">Distributor</div>
          <div className="text-white text-sm font-medium">Control Panel</div>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 text-sm transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-zinc-800">
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  )
}
