import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import TickerManager from './TickerManager'

export default async function TickerPage() {
  const user = await requireAdmin()
  const supabase = createAdminClient()

  const { data: messages } = await supabase
    .from('ticker_messages')
    .select('id, message, display_order, is_active, branch_id')
    .eq('customer_id', user.customer_id)
    .is('branch_id', null)
    .order('display_order', { ascending: true })

  return <TickerManager initialMessages={messages ?? []} />
}
