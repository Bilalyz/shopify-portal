import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ORG_COOKIE } from '@/lib/auth/org'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  // IMPORTANT: call getUser() before any redirect logic so token refreshes
  // are written back to the response cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const currentOrg = request.cookies.get(ORG_COOKIE)?.value

  const isDashboard = pathname.startsWith('/dashboard')
  const isOrgs     = pathname.startsWith('/orgs')
  const isPublic   = pathname.startsWith('/login') || pathname.startsWith('/auth')

  // ── Unauthenticated guards ────────────────────────────────────────────────
  if ((isDashboard || isOrgs) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ── Dashboard requires an active org selection ────────────────────────────
  if (isDashboard && user && !currentOrg) {
    const url = request.nextUrl.clone()
    url.pathname = '/orgs'
    return NextResponse.redirect(url)
  }

  // ── Authenticated users skip public pages ─────────────────────────────────
  if (isPublic && user && !pathname.startsWith('/auth')) {
    const url = request.nextUrl.clone()
    url.pathname = currentOrg ? '/dashboard' : '/orgs'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
