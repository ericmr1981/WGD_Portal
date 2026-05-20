import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Context } from 'netlify:edge'

export default async (request: Request, context: Context) => {
  const url = new URL(request.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  const appId = pathParts[1]
  const proxyPath = '/' + pathParts.slice(2).join('/')

  if (!appId) return new Response('Not found', { status: 404 })

  // Read session cookie
  const cookies = request.headers.get('cookie') || ''
  const sessionCookie = parseCookie(cookies, 'wgd_session')
  if (!sessionCookie) return redirectToLogin(url)

  let session
  try { session = JSON.parse(atob(sessionCookie)) } catch { return redirectToLogin(url) }
  if (!session.id) return redirectToLogin(url)

  // Init Supabase
  const supabase = createClient(
    context.env.NEXT_PUBLIC_SUPABASE_URL || '',
    context.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )

  // Verify user session
  const { data: userData } = await supabase.rpc('verify_session', { p_user_id: session.id })
  if (!userData?.valid) return redirectToLogin(url)

  // Get app URL
  const { data: appData } = await supabase.rpc('get_app_url', { p_app_id: appId })
  if (!appData?.url) return new Response('App not found', { status: 404 })

  const targetUrl = appData.url.replace(/\/$/, '')

  // ---- Build a fresh SSO token on initial page load ----
  let ssoToken = url.searchParams.get('sso_token')
  if (!ssoToken && proxyPath === '/') {
    const { data: tokenData } = await supabase.rpc('create_sso_token', {
      p_user_id: session.id,
      p_user_name: session.name || '',
      p_user_role: session.role || 'user',
    })
    if (tokenData?.token) ssoToken = tokenData.token
  }

  const ssoQuery = ssoToken ? `sso_token=${ssoToken}` : ''
  const fetchUrl = proxyPath === '/'
    ? ssoQuery ? `${targetUrl}?${ssoQuery}` : targetUrl
    : `${targetUrl}${proxyPath}${url.search}`

  try {
    const targetResponse = await fetch(fetchUrl, {
      headers: {
        'User-Agent': request.headers.get('User-Agent') || '',
        'Accept': request.headers.get('Accept') || '*/*',
        'Accept-Language': request.headers.get('Accept-Language') || '',
      },
      redirect: 'manual',
    })

    const contentType = targetResponse.headers.get('Content-Type') || ''
    const body = await targetResponse.text()
    const proxyBase = `/go/${appId}`

    // Rewrite & inject SSO token into HTML / JS / CSS responses
    let rewritten = body

    if (contentType.includes('html') || contentType.includes('javascript') || contentType.includes('text/css')) {
      if (ssoToken) {
        // Insert sso_token into _stcore URLs (append or inject query param)
        rewritten = rewritten
          .replace(
            new RegExp(`(/${proxyBase}/_stcore/[^"\'\\s]*)`, 'g'),
            (match) => match.includes('?') ? `${match}&sso_token=${ssoToken}` : `${match}?sso_token=${ssoToken}`
          )
          .replace(
            new RegExp(`(/_stcore/[^"\'\\s]*)`, 'g'),
            (match) => {
              const proxied = proxyBase + match
              return proxied.includes('?') ? `${proxied}&sso_token=${ssoToken}` : `${proxied}?sso_token=${ssoToken}`
            }
          )
      } else {
        // Still need to rewrite _stcore paths so they go through proxy
        rewritten = rewritten
          .replace(new RegExp(`(/_stcore/[^"\'\\s]*)`, 'g'), (m) => proxyBase + m)
      }
    }

    // Also rewrite root-relative general URLs for HTML
    if (contentType.includes('html') && !contentType.includes('javascript')) {
      rewritten = rewritten
        .replace(/href="\/(?!\/)/g, `href="${proxyBase}/`)
        .replace(/src="\/(?!\/)/g, `src="${proxyBase}/`)
        .replace(/action="\/(?!\/)/g, `action="${proxyBase}/`)
        .replace(/url\("\//g, `url("${proxyBase}/`)
    }

    const responseHeaders = new Headers()
    responseHeaders.set('Content-Type', contentType)
    responseHeaders.set('Cache-Control', 'no-store')
    responseHeaders.set('X-Frame-Options', 'SAMEORIGIN')

    return new Response(rewritten, {
      status: targetResponse.status,
      headers: responseHeaders,
    })
  } catch {
    return new Response('Proxy error', { status: 502 })
  }
}

function parseCookie(cookieString: string, name: string): string | null {
  const match = cookieString.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function redirectToLogin(currentUrl: URL): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `/login?redirect=${encodeURIComponent(currentUrl.pathname)}` },
  })
}

export const config = { path: '/go/*' }
