import { signAgentToken } from '../../src/lib/agent-token.js'

/**
 * Helper to read wgd_session from request cookies (server-side).
 */
function getSessionUserFromCookie(cookieHeader) {
  const match = (cookieHeader || '').match(/(?:^|;\s*)wgd_session=([^;]+)/)
  if (!match) return null
  try {
    const s = JSON.parse(decodeURIComponent(match[1]))
    if (!s?.id) return null
    return { id: s.id, username: s.username, role: s.role || 'user' }
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
  const cookieHeader = req.headers.cookie || ''
  const user = getSessionUserFromCookie(cookieHeader)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  try {
    const { token, exp } = await signAgentToken(user.id)
    return res.status(200).json({ token, exp })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}