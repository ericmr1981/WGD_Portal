// pages/api/mock-agent/inbound.js
// Mock agent inbound —— 接收 user.interrupt,触发对应 SSE 流中断。
// 仅在 NEXT_PUBLIC_USE_MOCK_AGENT=1 时由前端 useAgentSocket.send 调用。

import { getCurrentUser } from '../../../src/lib/auth'
import { triggerMockAbort } from './stream.js'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  const user = getCurrentUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ error: 'bad_json' })
  }
  if (!body || body.type !== 'user.interrupt') {
    return res.status(400).json({ error: 'unsupported_type', got: body?.type })
  }
  const conversationId = body.payload?.conversationId
  if (!conversationId) {
    return res.status(400).json({ error: 'missing_conversationId' })
  }

  const triggered = triggerMockAbort(conversationId)
  return res.status(200).json({ ok: true, triggered })
}