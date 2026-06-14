import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import TemplateManager from './TemplateManager'
import type { DisplayTemplate, ColumnDef } from './TemplateEditor'

export default async function TemplatesPage() {
  const user = await requireAdmin()
  const supabase = createAdminClient()

  const { data: templates } = await supabase
    .from('display_templates')
    .select('*')
    .eq('customer_id', user.customer_id)
    .order('created_at', { ascending: true })

  const mapped: DisplayTemplate[] = (templates ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    is_default: t.is_default,
    columns: ((t.columns ?? []) as unknown as ColumnDef[]),
    created_at: t.created_at,
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Display Templates</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Configure which columns appear on your TV screens. The default template is shown on all branches.
        </p>
      </div>
      <TemplateManager initialTemplates={mapped} />
    </div>
  )
}
