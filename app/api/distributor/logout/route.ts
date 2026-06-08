import { DISTRIBUTOR_COOKIE } from '@/lib/distributor-auth'

export async function POST() {
  const response = Response.json({ ok: true })
  response.headers.set(
    'Set-Cookie',
    `${DISTRIBUTOR_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  )
  return response
}
