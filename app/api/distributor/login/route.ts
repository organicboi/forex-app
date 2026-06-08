import { NextRequest } from 'next/server'
import { signDistributorToken, DISTRIBUTOR_COOKIE } from '@/lib/distributor-auth'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const { secret } = body ?? {}

  const expected = process.env.DISTRIBUTOR_SECRET
  if (!expected) {
    return Response.json({ error: 'Distributor access is not configured' }, { status: 503 })
  }

  if (!secret || secret !== expected) {
    return Response.json({ error: 'Invalid secret' }, { status: 401 })
  }

  const token = await signDistributorToken()

  const response = Response.json({ ok: true })
  const isSecure = request.headers.get('x-forwarded-proto') === 'https' ||
    !request.headers.get('host')?.startsWith('localhost')

  response.headers.set(
    'Set-Cookie',
    `${DISTRIBUTOR_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}${isSecure ? '; Secure' : ''}`
  )

  return response
}
