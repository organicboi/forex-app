import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isDistributorRequest } from '@/lib/distributor-auth'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const path = request.nextUrl.pathname

  // Distributor panel — separate auth, no Supabase session needed
  if (path.startsWith('/distributor') && path !== '/distributor') {
    const authed = await isDistributorRequest(request)
    if (!authed) {
      const dest = request.nextUrl.clone()
      dest.pathname = '/distributor'
      return NextResponse.redirect(dest)
    }
    return NextResponse.next()
  }

  // Must be called first — do not add logic before this.
  const { data: { user } } = await supabase.auth.getUser()

  // Protect /admin and /branch routes
  if (path.startsWith('/admin') || path.startsWith('/branch')) {
    if (!user) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/'
      return NextResponse.redirect(loginUrl)
    }

    // Check role vs path
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (path.startsWith('/admin') && profile?.role !== 'admin') {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/'
      return NextResponse.redirect(loginUrl)
    }

    if (path.startsWith('/branch') && profile?.role !== 'branch_user') {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/'
      return NextResponse.redirect(loginUrl)
    }
  }

  // Redirect authenticated users away from login page
  if (path === '/' && user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'admin') {
      const dest = request.nextUrl.clone()
      dest.pathname = '/admin/rates'
      return NextResponse.redirect(dest)
    }
    if (profile?.role === 'branch_user') {
      const dest = request.nextUrl.clone()
      dest.pathname = '/branch/rates'
      return NextResponse.redirect(dest)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|flags/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
