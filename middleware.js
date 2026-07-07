import { NextResponse } from 'next/server'

const PROTECTED_PATTERNS = [
  /^\/chat(\/|$)/,
  /^\/api\/sessions(\/|$)/,
  /^\/api\/agent-token$/,
]

function isProtected(pathname) {
  return PROTECTED_PATTERNS.some((re) => re.test(pathname))
}

export function middleware(req) {
  const { pathname } = req.nextUrl
  if (!isProtected(pathname)) return NextResponse.next()

  const cookieHeader = req.headers.get('cookie') || ''
  const hasSession = /(?:^|;\s*)wgd_session=/.test(cookieHeader)

  if (!hasSession) {
    if (pathname.startsWith('/api/')) {
      return new NextResponse(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/chat/:path*', '/api/sessions/:path*', '/api/agent-token'],
}
