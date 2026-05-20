import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Context } from 'netlify:edge'

export default async (request: Request, context: Context) => {
  const url = new URL(request.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  // /go/:appId/*  → pathParts = ['go', 'appId', ...]
  const appId = pathParts[1]
  const proxyPath = '/' + pathParts.slice(2).join('/')

  if (!appId) {
    return new Response('Not found', { status: 404 })
  }

  // Read session cookie
  const cookies = request.headers.get('cookie') || ''
  const sessionCookie = parseCookie(cookies, 'wgd_session')

  if (!sessionCookie) {
    return redirectToLogin(url)
  }

  let session
  try {
    session = JSON.parse(atob(sessionCookie))
  } catch {
    return redirectToLogin(url)
  }

  if (!session.id) {
    return redirectToLogin(url)
  }

  // Initialize Supabase client
  const supabase = createClient(
    context.env.NEXT_PUBLIC_SUPABASE_URL || '',
    context.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )

  // Verify session is still valid
  const { data: userData, error: userError } = await supabase
    .rpc('verify_session', { p_user_id: session.id })

  if (userError || !userData?.valid) {
    return redirectToLogin(url)
  }

  // Get app URL
  const { data: appData, error: appError } = await supabase
    .rpc('get_app_url', { p_app_id: appId })

  if (appError || !appData?.url) {
    return new Response('App not found', { status: 404 })
  }

  const targetUrl = appData.url.replace(/\/$/, '')
  const fetchUrl = proxyPath === '/' ? targetUrl : `${targetUrl}${proxyPath}${url.search}`

  try {
    const targetResponse = await fetch(fetchUrl, {
      headers: {
        'User-Agent': request.headers.get('User-Agent') || '',
        'Accept': request.headers.get('Accept') || '*/*',
        'Accept-Language': request.headers.get('Accept-Language') || '',
        'Cookie': request.headers.get('cookie') || '',
      },
      redirect: 'manual',
    })

    const contentType = targetResponse.headers.get('Content-Type') || 'text/html'
    const body = await targetResponse.text()

    // Rewrite URLs in HTML so all assets go through the proxy
    let rewritten = body
    if (contentType.includes('text/html')) {
      const proxyBase = `/go/${appId}`
      // Rewrite root-relative URLs to proxy-relative
      rewritten = body
        .replace(/href="\/(?!\/)/g, `href="${proxyBase}/`)
        .replace(/src="\/(?!\/)/g, `src="${proxyBase}/`)
        .replace(/action="\/(?!\/)/g, `action="${proxyBase}/`)
        .replace(/"\/_stcore\//g, `"${proxyBase}/_stcore/`)
        .replace(/'\/_stcore\//g, `'${proxyBase}/_stcore/`)
        .replace(/url\("\//g, `url("${proxyBase}/`)
    }

    // Build response headers (skip content-encoding since we decoded)
    const responseHeaders = new Headers()
    responseHeaders.set('Content-Type', contentType)
    responseHeaders.set('Cache-Control', 'no-store')
    responseHeaders.set('X-Frame-Options', 'SAMEORIGIN')

    return new Response(rewritten, {
      status: targetResponse.status,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response('Proxy error', { status: 502 })
  }
}

function parseCookie(cookieString: string, name: string): string | null {
  const match = cookieString.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function redirectToLogin(currentUrl: URL): Response {
  const loginUrl = `/login?redirect=${encodeURIComponent(currentUrl.pathname)}`
  return new Response(null, {
    status: 302,
    headers: { Location: loginUrl },
  })
}

export const config = {
  path: '/go/*',
}
