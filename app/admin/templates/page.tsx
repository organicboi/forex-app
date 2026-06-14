import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import TemplateManager from './TemplateManager'

export default async function TemplatesPage() {
  const user = await requireAdmin()
  const supabase = createAdminClient()

  const { data: templates } = await supabase
    .from('display_templates')
    .select('*')
    .eq('customer_id', user.customer_id)
    .order('created_at', { ascending: true })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Display Templates</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Configure which columns appear on your TV screens. The default template is shown on all branches.
        </p>
      </div>
      <TemplateManager initialTemplates={templates ?? []} />
    </div>
  )
}
