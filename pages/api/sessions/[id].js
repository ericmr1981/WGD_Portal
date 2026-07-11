import { getCurrentUser } from '../../../src/lib/auth.js'
import { signAgentToken } from '../../../src/lib/agent-token.js'

const AGENT_BASE = process.env.AGENT_HTTP_URL || 'http://127.0.0.1:4101'

export default async function handler(req, res) {
  const user = getCurrentUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  const token = (await signAgentToken(user.id)).token

  const hasBody = ['POST', 'PATCH', 'PUT'].includes(req.method)
  const init = {
    method: req.method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
    },
  }
  if (hasBody) {
    init.body = JSON.stringify(req.body ?? {})
  }

  // req.url is /api/sessions/<actual-id> after Next decodes the route param
  // e.g. /api/sessions/123 -> keep, /api/sessions/abc -> keep
  // Need to strip /api/sessions prefix and convert to /api/conversations/
  const url = req.url.split('?')[0]
  const agentPath = url
    .replace(/^\/api\/sessions/, '/api/conversations')
    .replace(/docs\/superpowers\//, '')  // fallback for when this file gets copied around

  const upstream = await fetch(`${AGENT_BASE}${agentPath}`, init)
  const text = await upstream.text()
  res.status(upstream.status)
    .setHeader('content-type', upstream.headers.get('content-type') || 'application/json')
    .send(text)
}