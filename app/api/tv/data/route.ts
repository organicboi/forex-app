import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return Response.json({ error: 'Missing token' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: branch } = await supabase
    .from('branches')
    .select('id, name')
    .eq('branch_token', token)
    .eq('is_active', true)
    .single()

  if (!branch) {
    return Response.json({ status: 'not_found' })
  }

  const { data, error } = await supabase.rpc('get_tv_data', { p_branch_id: branch.id })

  if (error) {
    console.error('[tv/data] get_tv_data error:', error.message)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }

  return Response.json({ ...(data as object), branch_name: branch.name })
}
