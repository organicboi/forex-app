import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'

interface ColumnDef {
  key: string
  label: string
  color: string
  visible: boolean
  order: number
  is_builtin: boolean
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

// GET — download Excel template pre-filled with existing rates
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const { data: template } = await supabase
    .from('display_templates')
    .select('*')
    .eq('id', id)
    .eq('customer_id', auth.customer_id)
    .single()

  if (!template) return Response.json({ error: 'Not found' }, { status: 404 })

  const columns: ColumnDef[] = (template.columns as ColumnDef[])
    .filter((c) => c.visible)
    .sort((a, b) => a.order - b.order)

  const { data: ccRows } = await supabase
    .from('customer_currencies')
    .select(`
      currency_id,
      currencies(code, name),
      rates(buy, sell, transfer, extra_values)
    `)
    .eq('customer_id', auth.customer_id)
    .eq('is_enabled', true)
    .order('display_order', { ascending: true })

  const headers = ['Currency Code', 'Currency Name', ...columns.map((c) => c.label)]

  const dataRows = (ccRows ?? []).map((cc) => {
    const cur = cc.currencies as unknown as { code: string; name: string } | { code: string; name: string }[] | null
    const rateArr = cc.rates as unknown as { buy: number; sell: number; transfer: number; extra_values?: Record<string, number> }[] | null
    const rate = Array.isArray(rateArr) ? rateArr[0] : rateArr
    const curObj = Array.isArray(cur) ? cur[0] : cur

    const row: (string | number)[] = [curObj?.code ?? '', curObj?.name ?? '']
    for (const col of columns) {
      if (col.is_builtin) {
        row.push(rate ? (rate as unknown as Record<string, number>)[col.key] ?? 0 : 0)
      } else {
        row.push(rate?.extra_values?.[col.key] ?? 0)
      }
    }
    return row
  })

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])

  // Style the header row bold
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[cellRef]) {
      ws[cellRef].s = { font: { bold: true } }
    }
  }

  // Set column widths
  ws['!cols'] = [
    { wch: 16 }, // Currency Code
    { wch: 24 }, // Currency Name
    ...columns.map(() => ({ wch: 14 })),
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Rates')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const safeName = (template.name as string).replace(/[^a-z0-9]/gi, '_').toLowerCase()
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeName}_rates.xlsx"`,
    },
  })
}

// POST — parse Excel and preview or commit
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthedAdmin()
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const { data: template } = await supabase
    .from('display_templates')
    .select('*')
    .eq('id', id)
    .eq('customer_id', auth.customer_id)
    .single()

  if (!template) return Response.json({ error: 'Not found' }, { status: 404 })

  const columns: ColumnDef[] = (template.columns as ColumnDef[])
    .filter((c) => c.visible)
    .sort((a, b) => a.order - b.order)

  const url = new URL(request.url)
  if (url.searchParams.get('action') === 'commit') {
    return handleCommit(request, auth, columns)
  }
  return handlePreview(request, auth, columns)
}

async function handlePreview(
  request: NextRequest,
  auth: { user_id: string; customer_id: string },
  columns: ColumnDef[]
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
  if (!rows.length) return Response.json({ error: 'Excel file has no data rows' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: ccRows } = await supabase
    .from('customer_currencies')
    .select('currency_id, currencies(code)')
    .eq('customer_id', auth.customer_id)
    .eq('is_enabled', true)

  const codeToId: Record<string, string> = {}
  for (const cc of ccRows ?? []) {
    const cur = cc.currencies as unknown as { code: string } | { code: string }[] | null
    const code = Array.isArray(cur) ? cur[0]?.code : cur?.code
    if (code) codeToId[code.toUpperCase()] = cc.currency_id
  }

  // Build label → column key mapping (case-insensitive)
  const labelToCol: Record<string, ColumnDef> = {}
  for (const col of columns) {
    labelToCol[col.label.toLowerCase().trim()] = col
  }

  const preview = rows.map((rawRow, i) => {
    const r: Record<string, string> = {}
    for (const [k, v] of Object.entries(rawRow)) {
      r[k.toLowerCase().trim()] = String(v ?? '').trim()
    }

    const code = (r['currency code'] ?? r['code'] ?? r['currency'] ?? '').toUpperCase()
    if (!code) return null

    const currency_id = codeToId[code] ?? null
    const values: Record<string, number> = {}
    for (const col of columns) {
      const raw = r[col.label.toLowerCase().trim()] ?? '0'
      const num = parseFloat(raw)
      values[col.key] = isNaN(num) ? 0 : num
    }

    return {
      row_index: i + 2,
      code,
      currency_id,
      values,
      error: currency_id ? undefined : 'Currency not enabled or not found',
    }
  }).filter(Boolean)

  const valid_count = preview.filter((r) => !r!.error).length
  return Response.json({
    preview,
    valid_count,
    columns: columns.map((c) => ({ key: c.key, label: c.label })),
  })
}

async function handleCommit(
  request: NextRequest,
  auth: { user_id: string; customer_id: string },
  columns: ColumnDef[]
) {
  const body = await request.json().catch(() => null)
  if (!body?.rows || !Array.isArray(body.rows)) {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: customer } = await supabase
    .from('customers')
    .select('plan_expires_at, is_active')
    .eq('id', auth.customer_id)
    .single()

  if (!customer?.is_active || new Date(customer.plan_expires_at) < new Date()) {
    return Response.json({ error: 'Plan expired or account inactive' }, { status: 403 })
  }

  // Fetch existing rates to merge non-template columns
  const currencyIds = body.rows.map((r: { currency_id: string }) => r.currency_id)
  const { data: existingRates } = await supabase
    .from('rates')
    .select('currency_id, buy, sell, transfer, extra_values')
    .eq('customer_id', auth.customer_id)
    .in('currency_id', currencyIds)

  const existing: Record<string, { buy: number; sell: number; transfer: number; extra_values: Record<string, number> }> = {}
  for (const r of existingRates ?? []) {
    existing[r.currency_id] = {
      buy: r.buy ?? 0,
      sell: r.sell ?? 0,
      transfer: r.transfer ?? 0,
      extra_values: (r.extra_values as Record<string, number>) ?? {},
    }
  }

  const customCols = columns.filter((c) => !c.is_builtin)

  const upserts = (body.rows as { currency_id: string; values: Record<string, number> }[]).map((row) => {
    const prev = existing[row.currency_id] ?? { buy: 0, sell: 0, transfer: 0, extra_values: {} }
    const newExtra = { ...prev.extra_values }
    for (const col of customCols) {
      newExtra[col.key] = row.values[col.key] ?? 0
    }
    return {
      customer_id: auth.customer_id,
      currency_id: row.currency_id,
      buy: columns.some((c) => c.key === 'buy') ? (row.values['buy'] ?? prev.buy) : prev.buy,
      sell: columns.some((c) => c.key === 'sell') ? (row.values['sell'] ?? prev.sell) : prev.sell,
      transfer: columns.some((c) => c.key === 'transfer') ? (row.values['transfer'] ?? prev.transfer) : prev.transfer,
      extra_values: newExtra,
      mode: 'excel' as const,
      updated_by: auth.user_id,
      updated_at: new Date().toISOString(),
    }
  })

  const { error } = await supabase
    .from('rates')
    .upsert(upserts, { onConflict: 'customer_id,currency_id' })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, imported: upserts.length })
}
