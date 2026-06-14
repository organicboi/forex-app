import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const token: string | undefined = body?.token
  const session_key: string | undefined = body?.session_key

  if (!token || !session_key) {
    return Response.json({ error: 'Missing token or session_key' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: screen } = await supabase
    .from('screens')
    .select('id, branch_id')
    .eq('screen_token', token)
    .eq('is_active', true)
    .single()

  if (!screen) {
    return Response.json({ error: 'Invalid token' }, { status: 404 })
  }

  await supabase.from('screen_sessions').upsert(
    {
      branch_id: screen.branch_id,
      screen_id: screen.id,
      session_key,
      last_seen_at: new Date().toISOString(),
      user_agent: request.headers.get('user-agent') ?? null,
      ip_address:
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
        request.headers.get('x-real-ip') ??
        null,
    },
    { onConflict: 'session_key' }
  )

  return Response.json({ ok: true })
}
