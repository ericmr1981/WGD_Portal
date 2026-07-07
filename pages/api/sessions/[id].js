import { getCurrentUser } from '../../../src/lib/auth.js'
import { signAgentToken } from '../../../src/lib/agent-token.js'

const AGENT_BASE = process.env.AGENT_HTTP_URL || 'http://127.0.0.1:4101'

export default async function handler(req, res) {
  const user = getCurrentUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  const token = signAgentToken(user.id).token

  const init = {
    method: req.method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  }
  if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
    init.body = JSON.stringify(req.body ?? {})
  }

  const agentPath = req.url.split('?')[0]
    .replace(/^\/api\/sessions\/\[id\]/, '/api/conversations/')
    .replace('/api/conversations/[id]', '/api/conversations/' + (req.query.id || ''))
    .replace(/\/\[id\]/, '/' + (req.query.id || ''))

  const upstream = await fetch(`${AGENT_BASE}${agentPath}`, init)
  const text = await upstream.text()
  res.status(upstream.status)
    .setHeader('content-type', upstream.headers.get('content-type') || 'application/json')
    .send(text)
}