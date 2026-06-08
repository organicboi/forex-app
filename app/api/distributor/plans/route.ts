import { NextRequest } from 'next/server'
import { isDistributorRequest } from '@/lib/distributor-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database.types'

async function authCheck(request: NextRequest) {
  return isDistributorRequest(request)
}

export async function GET(request: NextRequest) {
  if (!(await authCheck(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('plans')
    .select('id, name, max_branches, storage_mb, allow_live_rates, allow_excel_import, allow_layout_config, allow_branch_rate_edit, duration_days, price_note, is_active, created_at')
    .order('name', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!(await authCheck(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const {
    name, max_branches = 5, storage_mb = 500,
    allow_live_rates = true, allow_excel_import = true,
    allow_layout_config = true, allow_branch_rate_edit = false,
    duration_days = 365, price_note,
  } = body ?? {}

  if (!name?.trim()) return Response.json({ error: 'Plan name is required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('plans')
    .insert({
      name: name.trim(),
      max_branches: Number(max_branches) || 5,
      storage_mb: Number(storage_mb) || 500,
      allow_live_rates: Boolean(allow_live_rates),
      allow_excel_import: Boolean(allow_excel_import),
      allow_layout_config: Boolean(allow_layout_config),
      allow_branch_rate_edit: Boolean(allow_branch_rate_edit),
      duration_days: Number(duration_days) || 365,
      price_note: price_note?.trim() || null,
    })
    .select('id, name, max_branches, storage_mb, allow_live_rates, allow_excel_import, allow_layout_config, allow_branch_rate_edit, duration_days, price_note, is_active')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  if (!(await authCheck(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ error: 'Invalid body' }, { status: 400 })

  const allowed = ['name', 'max_branches', 'storage_mb', 'allow_live_rates', 'allow_excel_import',
    'allow_layout_config', 'allow_branch_rate_edit', 'duration_days', 'price_note', 'is_active'] as const

  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('plans')
    .update(updates as Database['public']['Tables']['plans']['Update'])
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  if (!(await authCheck(request))) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

  const supabase = createAdminClient()

  // Check if any customers use this plan
  const { data: inUse } = await supabase
    .from('customers')
    .select('id')
    .eq('plan_id', id)
    .limit(1)
    .single()

  if (inUse) {
    return Response.json({ error: 'Cannot delete a plan that is assigned to customers' }, { status: 409 })
  }

  const { error } = await supabase.from('plans').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
