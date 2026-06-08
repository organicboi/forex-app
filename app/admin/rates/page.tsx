import { requireAdmin, getCustomerWithPlan } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import RateTable from './RateTable'
import ExcelImport from './ExcelImport'

export default async function RatesPage() {
  const user = await requireAdmin()
  const customer = await getCustomerWithPlan(user.customer_id)
  const supabase = createAdminClient()

  // Fetch enabled currencies + their current rates
  const { data: ccRows } = await supabase
    .from('customer_currencies')
    .select(`
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
    .eq('is_enabled', true)
    .order('display_order', { ascending: true })

  const currencyIds = (ccRows ?? []).map((r) => r.currency_id)

  const { data: rateRows } = await supabase
    .from('rates')
    .select('currency_id, buy, sell, transfer, mode, updated_at')
    .eq('customer_id', user.customer_id)
    .in('currency_id', currencyIds.length > 0 ? currencyIds : ['00000000-0000-0000-0000-000000000000'])

  const rateMap = Object.fromEntries(
    (rateRows ?? []).map((r) => [r.currency_id, r])
  )

  const merged = (ccRows ?? []).map((cc) => ({
    ...cc,
    rates: rateMap[cc.currency_id]
      ? [rateMap[cc.currency_id]]
      : [{ buy: 0, sell: 0, transfer: 0, mode: 'manual' as const, updated_at: null }],
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Exchange Rates</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Set buy, sell, and transfer rates for each currency. Changes push to all branch TVs within 30 seconds.
        </p>
      </div>

      {merged.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No currencies are enabled.</p>
          <p className="text-zinc-600 text-xs mt-2">
            Go to <a href="/admin/currencies" className="text-purple-400 hover:underline">Currencies</a> to enable currencies first.
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
      )}
    </div>
  )
}
