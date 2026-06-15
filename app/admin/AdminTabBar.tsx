import Link from 'next/link'

interface Tab {
  key: string
  label: string
}

interface Props {
  tabs: Tab[]
  activeTab: string
  basePath: string
  paramName?: string
}

export default function AdminTabBar({ tabs, activeTab, basePath, paramName = 'tab' }: Props) {
  return (
    <div className="flex items-center gap-0 border-b border-zinc-800 mb-6">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key
        const href = `${basePath}?${paramName}=${tab.key}`
        return (
          <Link
            key={tab.key}
            href={href}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              isActive
                ? 'text-white border-purple-500'
                : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:border-zinc-600'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
