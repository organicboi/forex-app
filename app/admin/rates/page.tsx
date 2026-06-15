import { requireAdmin, getCustomerWithPlan } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import RateTable from './RateTable'
import ExcelImport from './ExcelImport'
import CurrencyManager from '../currencies/CurrencyManager'
import AdminTabBar from '../AdminTabBar'

const TABS = [
  { key: 'rates', label: 'Rates' },
  { key: 'currencies', label: 'Currencies' },
]

const DESCRIPTIONS = {
  rates: 'Set buy, sell, and transfer rates for each currency. Changes push to all branch TVs within 30 seconds.',
  currencies: 'Choose which currencies appear on your TV screens, set their display order, and configure decimal places.',
}

export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await requireAdmin()
  const customer = await getCustomerWithPlan(user.customer_id)
  const supabase = createAdminClient()
  const { tab } = await searchParams
  const activeTab = tab === 'currencies' ? 'currencies' : 'rates'

  const { data: ccRows } = await supabase
    .from('customer_currencies')
    .select(`
      id,
      currency_id,
      is_enabled,
      display_order,
      decimal_places,
      currencies (
        code,
        name,
        flag_path,
        default_decimals
      )
    `)
    .eq('customer_id', user.customer_id)
    .order('display_order', { ascending: true })

  let ratesContent = null

  if (activeTab === 'rates') {
    const enabledRows = (ccRows ?? []).filter((r) => r.is_enabled)
    const currencyIds = enabledRows.map((r) => r.currency_id)

    const { data: rateRows } = await supabase
      .from('rates')
      .select('currency_id, buy, sell, transfer, mode, updated_at')
      .eq('customer_id', user.customer_id)
      .in('currency_id', currencyIds.length > 0 ? currencyIds : ['00000000-0000-0000-0000-000000000000'])

    const rateMap = Object.fromEntries(
      (rateRows ?? []).map((r) => [r.currency_id, r])
    )

    const merged = enabledRows.map((cc) => ({
      ...cc,
      rates: rateMap[cc.currency_id]
        ? [rateMap[cc.currency_id]]
        : [{ buy: 0, sell: 0, transfer: 0, mode: 'manual' as const, updated_at: null }],
    }))

    ratesContent = merged.length === 0 ? (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
        <p className="text-zinc-500 text-sm">No currencies are enabled.</p>
        <p className="text-zinc-600 text-xs mt-2">
          Switch to the{' '}
          <a href="/admin/rates?tab=currencies" className="text-purple-400 hover:underline">
            Currencies tab
          </a>{' '}
          to enable currencies first.
        </p>
      </div>
    ) : (
      <div className="flex flex-col gap-6">
        <RateTable
          initialData={merged as unknown as Parameters<typeof RateTable>[0]['initialData']}
          baseCurrency={customer?.base_currency ?? 'AED'}
        />
        {customer?.plan.allow_excel_import && <ExcelImport />}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">
          {activeTab === 'rates' ? 'Exchange Rates' : 'Currencies'}
        </h1>
        <p className="text-zinc-500 text-sm mt-1">{DESCRIPTIONS[activeTab]}</p>
      </div>

      <AdminTabBar tabs={TABS} activeTab={activeTab} basePath="/admin/rates" />

      {activeTab === 'rates' ? ratesContent : (
        !ccRows || ccRows.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
            <p className="text-zinc-500 text-sm">No currencies configured.</p>
            <p className="text-zinc-600 text-xs mt-2">
              Run <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">DB/seed_demo.sql</code> in Supabase SQL editor to seed demo data.
            </p>
          </div>
        ) : (
          <CurrencyManager initialData={ccRows as unknown as Parameters<typeof CurrencyManager>[0]['initialData']} />
        )
      )}
    </div>
  )
}
