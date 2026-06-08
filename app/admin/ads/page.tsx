import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import AdManager from './AdManager'

export default async function AdsPage() {
  const user = await requireAdmin()
  const supabase = createAdminClient()

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

  const storageMb = {
    used: Number(storage?.used_mb ?? 0),
    limit: Number(storage?.limit_mb ?? 500),
  }

  return (
    <AdManager
      initialAds={(ads ?? []) as Parameters<typeof AdManager>[0]['initialAds']}
      branches={branches ?? []}
      storageMb={storageMb}
    />
  )
}
