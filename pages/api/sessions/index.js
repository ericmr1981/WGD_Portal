import { getCurrentUser } from '../../../src/lib/auth.js'
import { signAgentToken } from '../../../src/lib/agent-token.js'

const AGENT_BASE = process.env.AGENT_HTTP_URL || 'http://127.0.0.1:4101'

async function getBearer(req) {
  const user = getCurrentUser(req)
  if (!user) return null
  const { token } = await signAgentToken(user.id)
  return token
}

function agentPath(req) {
  // /api/sessions        → /api/conversations
  // /api/sessions/abc    → /api/conversations/abc
  return req.url.split('?')[0].replace(/^\/api\/sessions/, '/api/conversations')
}

async function proxy(req, res) {
  const token = await getBearer(req)
  if (!token) return res.status(401).json({ error: 'unauthorized' })

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

  const upstream = await fetch(`${AGENT_BASE}${agentPath(req)}`, init)
  const text = await upstream.text()
  res.status(upstream.status)
    .setHeader('content-type', upstream.headers.get('content-type') || 'application/json')
    .send(text)
}

export default proxy