import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import CurrencyManager from './CurrencyManager'

export default async function CurrenciesPage() {
  const user = await requireAdmin()
  const supabase = createAdminClient()

  const { data, error } = await supabase
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Currencies</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Choose which currencies appear on your TV screens, set their display order, and configure decimal places.
        </p>
      </div>

      {error ? (
        <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-lg">
          Failed to load currencies: {error.message}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No currencies configured.</p>
          <p className="text-zinc-600 text-xs mt-2">
            Run <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">DB/seed_demo.sql</code> in Supabase SQL editor to seed demo data.
          </p>
        </div>
      ) : (
        <CurrencyManager initialData={data as unknown as Parameters<typeof CurrencyManager>[0]['initialData']} />
      )}
    </div>
  )
}
