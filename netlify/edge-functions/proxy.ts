import type { Context } from 'netlify:edge'

const SUPABASE_URL = 'https://ltwqcvqfwwvjrcwnwvvn.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0d3FjdnFmd3d2anJjd253dnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5Mzg2NTEsImV4cCI6MjA5MzUxNDY1MX0.5DfNAcXFBYT6eU6PArTocqFqWtNyXcKeQDlpZS5RN0E'

async function supabaseRpc(functionName: string, params: Record<string, unknown>): Promise<any> {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(params),
  })
  if (!resp.ok) return null
  return resp.json()
}

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
  if (!session?.id) return redirectToLogin(url)

  // Verify user session exists in DB
  const userData = await supabaseRpc('verify_session', { p_user_id: session.id })
  if (!userData?.valid) return redirectToLogin(url)

  // Get app URL
  const appData = await supabaseRpc('get_app_url', { p_app_id: appId })
  if (!appData?.url) return new Response('App not found', { status: 404 })

  const targetUrl = appData.url.replace(/\/$/, '')

  // ---- Build a fresh SSO token on initial page load ----
  let ssoToken = url.searchParams.get('sso_token')
  if (!ssoToken && proxyPath === '/') {
    const tokenData = await supabaseRpc('create_sso_token', {
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
        rewritten = rewritten
          .replace(
            new RegExp(`(/${proxyBase}/_stcore/[^"'\\s]*)`, 'g'),
            (match) => match.includes('?') ? `${match}&sso_token=${ssoToken}` : `${match}?sso_token=${ssoToken}`
          )
          .replace(
            new RegExp(`(/_stcore/[^"'\\s]*)`, 'g'),
            (match) => {
              const proxied = proxyBase + match
              return proxied.includes('?') ? `${proxied}&sso_token=${ssoToken}` : `${proxied}?sso_token=${ssoToken}`
            }
          )
      } else {
        rewritten = rewritten
          .replace(new RegExp(`(/_stcore/[^"'\\s]*)`, 'g'), (m) => proxyBase + m)
      }
    }

    // Rewrite root-relative general URLs for HTML
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
