// src/lib/agent-token.js
// RS256 token 签发 + JWKS 暴露
// - 首次调用时生成 RSA 密钥对(2048),缓存到 globalThis 防 HMR 丢失
// - signAgentToken: RS256 签名, sub=user.id, exp=10 分钟
// - getAgentJWKS: 返回公钥 JWK 数组供 Agent 验签

const TOKEN_TTL_SECONDS = 600

const SLOT_KEY = '__wdg_agent_rsa_keypair__'

async function getJose() {
  return await import('jose')
}

async function getKeyPair() {
  const g = globalThis
  if (g[SLOT_KEY]) return g[SLOT_KEY]
  const jose = await getJose()
  const { privateKey, publicKey } = await jose.generateKeyPair('RS256', {
    modulusLength: 2048,
    extractable: true,
  })
  const publicJwkRaw = await jose.exportJWK(publicKey)
  const kid = `portal-${Date.now()}`
  const publicJwk = { ...publicJwkRaw, kid, alg: 'RS256', use: 'sig' }
  g[SLOT_KEY] = { privateKey, publicKey, publicJwk, kid }
  return g[SLOT_KEY]
}

export async function signAgentToken(userId) {
  if (!userId) throw new Error('userId required')
  const jose = await getJose()
  const kp = await getKeyPair()
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  const token = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: kp.kid })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(kp.privateKey)
  return { token, exp }
}

export async function getAgentJWKS() {
  const kp = await getKeyPair()
  return { keys: [kp.publicJwk] }
}
