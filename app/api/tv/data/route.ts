import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface ColumnDef {
  key: string
  label: string
  color: string
  visible: boolean
  order: number
  is_builtin: boolean
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return Response.json({ error: 'Missing token' }, { status: 400 })

  const supabase = createAdminClient()

  // Resolve screen by screen_token
  const { data: screen } = await supabase
    .from('screens')
    .select('id, branch_id, customer_id, template_id, is_active')
    .eq('screen_token', token)
    .single()

  if (!screen || !screen.is_active) {
    return Response.json({ status: 'not_found' })
  }

  const { data: branch } = await supabase
    .from('branches')
    .select('id, name, is_active')
    .eq('id', screen.branch_id)
    .eq('is_active', true)
    .single()

  if (!branch) return Response.json({ status: 'not_found' })

  const { data, error } = await supabase.rpc('get_tv_data', { p_branch_id: branch.id })

  if (error) {
    console.error('[tv/data] get_tv_data error:', error.message)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }

  const tvData = data as Record<string, unknown>

  // Resolve template: screen's own → customer default → null
  let templateColumns: ColumnDef[] | null = null

  if (screen.template_id) {
    const { data: tpl } = await supabase
      .from('display_templates')
      .select('columns')
      .eq('id', screen.template_id)
      .single()
    if (tpl) templateColumns = tpl.columns as ColumnDef[]
  }

  if (!templateColumns) {
    const { data: defaultTpl } = await supabase
      .from('display_templates')
      .select('columns')
      .eq('customer_id', screen.customer_id)
      .eq('is_default', true)
      .single()
    if (defaultTpl) templateColumns = defaultTpl.columns as ColumnDef[]
  }

  // Fetch extra_values for custom columns
  const { data: extraRows } = await supabase
    .from('rates')
    .select('currency_id, extra_values, currencies(code)')
    .eq('customer_id', screen.customer_id)

  const extraByCode: Record<string, Record<string, number>> = {}
  for (const row of extraRows ?? []) {
    const cur = row.currencies as unknown as { code: string } | { code: string }[] | null
    const code = Array.isArray(cur) ? cur[0]?.code : cur?.code
    if (code) {
      extraByCode[code] = (row.extra_values as Record<string, number>) ?? {}
    }
  }

  const currencies = tvData.currencies as Array<Record<string, unknown>> | undefined
  const enrichedCurrencies = currencies?.map((c) => ({
    ...c,
    extra_values: extraByCode[(c.code as string) ?? ''] ?? {},
  }))

  return Response.json({
    ...tvData,
    currencies: enrichedCurrencies ?? currencies,
    branch_name: branch.name,
    template_columns: templateColumns,
  })
}
