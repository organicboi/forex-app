import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export const DISTRIBUTOR_COOKIE = 'dist_session'
const ALGORITHM = 'HS256'

function getSecret() {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET env var is not set')
  return new TextEncoder().encode(s)
}

export async function signDistributorToken(): Promise<string> {
  return new SignJWT({ role: 'distributor' })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret())
}

export async function verifyDistributorToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret())
    return true
  } catch {
    return false
  }
}

/** Server component helper — reads cookie store */
export async function requireDistributor(): Promise<true> {
  const cookieStore = await cookies()
  const token = cookieStore.get(DISTRIBUTOR_COOKIE)?.value
  if (!token || !(await verifyDistributorToken(token))) {
    throw new Error('Distributor auth required')
  }
  return true
}

/** Middleware helper — reads from NextRequest (no async cookie store) */
export async function isDistributorRequest(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(DISTRIBUTOR_COOKIE)?.value
  if (!token) return false
  return verifyDistributorToken(token)
}
