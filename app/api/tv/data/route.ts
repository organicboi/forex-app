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

interface AdRow {
  id: string
  file_url: string
  file_type: string
  duration_seconds: number
  is_active: boolean
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return Response.json({ error: 'Missing token' }, { status: 400 })

  const supabase = createAdminClient()

  // Resolve screen by screen_token
  const { data: screen } = await supabase
    .from('screens')
    .select('id, branch_id, customer_id, template_id, orientation, layout, is_active')
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
    if (tpl) templateColumns = tpl.columns as unknown as ColumnDef[]
  }

  if (!templateColumns) {
    const { data: defaultTpl } = await supabase
      .from('display_templates')
      .select('columns')
      .eq('customer_id', screen.customer_id)
      .eq('is_default', true)
      .single()
    if (defaultTpl) templateColumns = defaultTpl.columns as unknown as ColumnDef[]
  }

  // Resolve screen-specific ads: if screen has assignments, use those instead of RPC ads
  let resolvedAds: unknown[] | undefined = tvData.ads as unknown[] | undefined

  const { data: screenAdRows } = await supabase
    .from('screen_ads')
    .select('display_order, ads(id, file_url, file_type, duration_seconds, is_active)')
    .eq('screen_id', screen.id)
    .order('display_order', { ascending: true })

  if (screenAdRows && screenAdRows.length > 0) {
    resolvedAds = screenAdRows
      .map((row) => {
        const ad = row.ads as unknown as AdRow | null
        if (!ad || !ad.is_active) return null
        return { id: ad.id, file_url: ad.file_url, file_type: ad.file_type, duration_seconds: ad.duration_seconds }
      })
      .filter(Boolean)
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
    ads: resolvedAds,
    branch_name: branch.name,
    template_columns: templateColumns,
    screen_orientation: screen.orientation ?? 'landscape',
    screen_layout: screen.layout ?? 'split-standard',
  })
}
