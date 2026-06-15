import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import AdManager from '../ads/AdManager'
import TickerManager from '../ticker/TickerManager'
import TemplateManager from '../templates/TemplateManager'
import type { DisplayTemplate, ColumnDef } from '../templates/TemplateEditor'
import AdminTabBar from '../AdminTabBar'

const TABS = [
  { key: 'ads', label: 'Ads' },
  { key: 'ticker', label: 'Ticker' },
  { key: 'templates', label: 'Templates' },
]

const DESCRIPTIONS: Record<string, { title: string; desc: string }> = {
  ads: {
    title: 'Ads',
    desc: 'Upload and manage images and videos that play on your TV screens between rate updates.',
  },
  ticker: {
    title: 'Ticker',
    desc: 'Scrolling text messages shown at the bottom of your TV screens.',
  },
  templates: {
    title: 'Display Templates',
    desc: 'Configure which columns appear on your TV screens. The default template is shown on all branches.',
  },
}

export default async function DisplayPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await requireAdmin()
  const supabase = createAdminClient()
  const { tab } = await searchParams
  const activeTab = TABS.some((t) => t.key === tab) ? (tab as string) : 'ads'

  const { title, desc } = DESCRIPTIONS[activeTab]

  let content: React.ReactNode = null

  if (activeTab === 'ads') {
    const [{ data: ads }, { data: branches }, { data: storage }] = await Promise.all([
      supabase
        .from('ads')
        .select('id, file_url, file_type, duration_seconds, display_order, is_active, file_size_bytes, original_name, branch_id')
        .eq('customer_id', user.customer_id)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('branches')
        .select('id, name')
        .eq('customer_id', user.customer_id)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabase
        .from('v_customer_storage')
        .select('used_mb, limit_mb')
        .eq('customer_id', user.customer_id)
        .single(),
    ])

    content = (
      <AdManager
        initialAds={(ads ?? []) as Parameters<typeof AdManager>[0]['initialAds']}
        branches={branches ?? []}
        storageMb={{ used: Number(storage?.used_mb ?? 0), limit: Number(storage?.limit_mb ?? 500) }}
      />
    )
  } else if (activeTab === 'ticker') {
    const { data: messages } = await supabase
      .from('ticker_messages')
      .select('id, message, display_order, is_active, branch_id')
      .eq('customer_id', user.customer_id)
      .is('branch_id', null)
      .order('display_order', { ascending: true })

    content = <TickerManager initialMessages={messages ?? []} />
  } else if (activeTab === 'templates') {
    const { data: templates } = await supabase
      .from('display_templates')
      .select('*')
      .eq('customer_id', user.customer_id)
      .order('created_at', { ascending: true })

    const mapped: DisplayTemplate[] = (templates ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      is_default: t.is_default,
      columns: (t.columns ?? []) as unknown as ColumnDef[],
      created_at: t.created_at,
    }))

    content = <TemplateManager initialTemplates={mapped} />
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <p className="text-zinc-500 text-sm mt-1">{desc}</p>
      </div>

      <AdminTabBar tabs={TABS} activeTab={activeTab} basePath="/admin/display" />

      {content}
    </div>
  )
}
