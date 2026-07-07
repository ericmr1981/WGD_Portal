import { getCurrentUser } from '../../src/lib/auth.js'
import { signAgentToken } from '../../src/lib/agent-token.js'

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
  const user = getCurrentUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  try {
    const { token, exp } = signAgentToken(user.id)
    return res.status(200).json({ token, exp })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
