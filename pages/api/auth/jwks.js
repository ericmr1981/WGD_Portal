// pages/api/auth/jwks.json.js
// RS256 公钥发布端点 —— Agent 端用这个 URL 拉 JWKS 验证 portal 签的 token。
//
// 公钥对应的私钥在 src/lib/agent-token.ts 内存里,启动时生成一次,HMR 缓存复用。

import { getAgentJWKS } from '../../../src/lib/agent-token.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

  // Cache-Control: 让 Agent / createRemoteJWKSet 可以短时缓存
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
  res.setHeader('Content-Type', 'application/json')

  try {
    const jwks = await getAgentJWKS()
    return res.status(200).json(jwks)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}