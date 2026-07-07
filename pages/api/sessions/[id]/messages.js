import { getCurrentUser } from '../../../../src/lib/auth.js'
import { signAgentToken } from '../../../../src/lib/agent-token.js'

const AGENT_BASE = process.env.AGENT_HTTP_URL || 'http://127.0.0.1:4101'

export default async function handler(req, res) {
  const user = getCurrentUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  const token = signAgentToken(user.id).token

  const id = req.query.id
  if (!id) return res.status(400).json({ error: 'missing_id' })

  const upstream = await fetch(`${AGENT_BASE}/api/conversations/${id}/messages`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  })
  const text = await upstream.text()
  res.status(upstream.status)
    .setHeader('content-type', upstream.headers.get('content-type') || 'application/json')
    .send(text)
}