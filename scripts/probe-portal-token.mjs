// scripts/probe-portal-token.mjs
// 闭环验证 portal 端的 RS256 token:portal 签的 token,用 portal 自己的 JWKS 校验通过
// 这证明 portal 内部一致性 OK —— 接下来只要 Agent 用同一个 JWKS 就能验

import { jwtVerify, importJWK } from 'jose'

const PORTAL_BASE = process.env.PORTAL_BASE || 'http://localhost:3000'

// 1. dev-login 拿 cookie
const loginRes = await fetch(`${PORTAL_BASE}/api/auth/dev-login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ userId: 'u1', username: 'admin', role: 'admin' }),
})
const setCookie = loginRes.headers.get('set-cookie')
console.log('[login]', loginRes.status, setCookie ? 'cookie set' : 'no cookie')

const cookieHeader = setCookie?.split(';')[0] || ''

// 2. 拉 JWKS
const jwksRes = await fetch(`${PORTAL_BASE}/api/auth/jwks.json`)
const jwks = await jwksRes.json()
console.log('[jwks]', jwksRes.status, 'kid=', jwks.keys[0]?.kid, 'alg=', jwks.keys[0]?.alg)

// 3. 拿 agent-token
const tokenRes = await fetch(`${PORTAL_BASE}/api/agent-token`, {
  headers: { cookie: cookieHeader },
})
const { token, exp } = await tokenRes.json()
console.log('[token]', tokenRes.status, 'len=', token.length, 'exp=', exp)

// 4. 用 JWKS 公钥校验
const key = await importJWK(jwks.keys[0], 'RS256')
let verified
try {
  verified = await jwtVerify(token, key, { algorithms: ['RS256'] })
  console.log('[verify] OK sub=', verified.payload.sub, 'exp=', verified.payload.exp)
} catch (e) {
  console.log('[verify] FAIL', e.message)
  process.exit(1)
}

// 5. 拿 conversations 列表
const convRes = await fetch(`${PORTAL_BASE}/api/sessions`, { headers: { cookie: cookieHeader } })
const text = await convRes.text()
console.log('[conversations]', convRes.status, text.slice(0, 200))

// 6. 拿 conversations 详细(messages)
const match = text.match(/"conversationId":"([^"]+)"/)
if (match) {
  const cid = match[1]
  const msgRes = await fetch(`${PORTAL_BASE}/api/sessions/${cid}/messages`, {
    headers: { cookie: cookieHeader },
  })
  const msgBody = await msgRes.text()
  console.log('[messages]', msgRes.status, msgBody.slice(0, 300))
} else {
  console.log('[messages] skip — no conversationId found')
}