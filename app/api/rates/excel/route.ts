import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'

interface PreviewRow {
  row_index: number
  code: string
  buy: number
  sell: number
  transfer: number
  currency_id: string | null
  error?: string
}

async function getAuthedAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('id, customer_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return null
  return { user_id: profile.id, customer_id: profile.customer_id }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const action = url.searchParams.get('action')

  if (action === 'commit') {
    return handleCommit(request, auth)
  }
  return handlePreview(request, auth)
}

async function handlePreview(
  request: NextRequest,
  auth: { user_id: string; customer_id: string }
) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return Response.json({ error: 'No file uploaded' }, { status: 400 })
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    return Response.json({ error: 'File must be .xlsx or .xls' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  let rows: Record<string, unknown>[]

  try {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  } catch {
    return Response.json({ error: 'Failed to parse Excel file — make sure it is a valid .xlsx' }, { status: 400 })
  }

  if (!rows.length) {
    return Response.json({ error: 'Excel file has no data rows' }, { status: 400 })
  }

  // Fetch enabled currencies for this customer
  const supabase = createAdminClient()
  const { data: ccRows } = await supabase
    .from('customer_currencies')
    .select('currency_id, currencies(code)')
    .eq('customer_id', auth.customer_id)
    .eq('is_enabled', true)

  const codeToId: Record<string, string> = {}
  for (const cc of ccRows ?? []) {
    const cur = cc.currencies as unknown as { code: string } | { code: string }[] | null
    if (!cur) continue
    const code = Array.isArray(cur) ? cur[0]?.code : cur.code
    if (code) codeToId[code.toUpperCase()] = cc.currency_id
  }

  const preview: PreviewRow[] = []

  for (let i = 0; i < rows.length; i++) {
    // Normalize column keys: lowercase + trim
    const r: Record<string, string> = {}
    for (const [k, v] of Object.entries(rows[i])) {
      r[k.toLowerCase().trim()] = String(v ?? '').trim()
    }

    const code = (r['code'] ?? r['currency'] ?? r['currency code'] ?? '').toUpperCase()
    if (!code) continue

    const buy = parseFloat(r['buy'] ?? r['buy rate'] ?? '0')
    const sell = parseFloat(r['sell'] ?? r['sell rate'] ?? '0')
    const transfer = parseFloat(r['transfer'] ?? r['remit'] ?? r['remittance'] ?? '0')

    const currency_id = codeToId[code] ?? null

    preview.push({
      row_index: i + 2,
      code,
      buy: isNaN(buy) ? 0 : buy,
      sell: isNaN(sell) ? 0 : sell,
      transfer: isNaN(transfer) ? 0 : transfer,
      currency_id,
      error: currency_id ? undefined : 'Currency not enabled or not found',
    })
  }

  const valid_count = preview.filter((r) => !r.error).length
  return Response.json({ preview, valid_count })
}

async function handleCommit(
  request: NextRequest,
  auth: { user_id: string; customer_id: string }
) {
  const body = await request.json().catch(() => null)
  if (!body?.rows || !Array.isArray(body.rows)) {
    return Response.json({ error: 'Invalid body: expected { rows: [...] }' }, { status: 400 })
  }

  const { rows, rows_total = 0, rows_failed = 0, error_summary = null } = body

  const supabase = createAdminClient()

  // Gate: check plan is active
  const { data: customer } = await supabase
    .from('customers')
    .select('plan_expires_at, is_active')
    .eq('id', auth.customer_id)
    .single()

  if (!customer?.is_active || new Date(customer.plan_expires_at) < new Date()) {
    return Response.json({ error: 'Plan expired or account inactive' }, { status: 403 })
  }

  // Upsert rates — mode='excel' so rate_history trigger records the source
  const upserts = (rows as { currency_id: string; buy: number; sell: number; transfer: number }[]).map(
    (row) => ({
      customer_id: auth.customer_id,
      currency_id: row.currency_id,
      buy: Number(row.buy) || 0,
      sell: Number(row.sell) || 0,
      transfer: Number(row.transfer) || 0,
      mode: 'excel' as const,
      updated_by: auth.user_id,
      updated_at: new Date().toISOString(),
    })
  )

  const { error: upsertError } = await supabase
    .from('rates')
    .upsert(upserts, { onConflict: 'customer_id,currency_id' })

  if (upsertError) return Response.json({ error: upsertError.message }, { status: 500 })

  // Append-only import log
  await supabase.from('excel_imports').insert({
    customer_id: auth.customer_id,
    imported_by: auth.user_id,
    rows_total,
    rows_success: rows.length,
    rows_failed,
    error_summary: Array.isArray(error_summary) && error_summary.length > 0 ? error_summary : null,
  })

  return Response.json({ ok: true, imported: rows.length })
}
