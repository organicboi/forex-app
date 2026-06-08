import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import BranchDetail from './BranchDetail'

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireAdmin()
  const { id } = await params
  const supabase = createAdminClient()

  const { data: branch } = await supabase
    .from('branches')
    .select('id, name, location_note, layout, allow_user_rate_edit, is_active, branch_token')
    .eq('id', id)
    .eq('customer_id', user.customer_id)
    .single()

  if (!branch) notFound()

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl = `${proto}://${host}`

  return <BranchDetail branch={branch} baseUrl={baseUrl} />
}
