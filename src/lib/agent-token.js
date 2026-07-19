// src/lib/agent-token.js
// RS256 token 签发 + JWKS 暴露
// - 首次调用时生成 RSA 密钥对(2048),持久化到磁盘防冷启动 kid 变化
//   (若 agent 缓存了 JWKS,portal 重启后 kid 变了会导致 verify 失败 → 401)
// - signAgentToken: RS256 签名, sub=user.id, exp=10 分钟
// - getAgentJWKS: 返回公钥 JWK 数组供 Agent 验签

const TOKEN_TTL_SECONDS = 600

const SLOT_KEY = '__wdg_agent_rsa_keypair__'
// 必须放在 portal 进程 (www-data) 能写的目录
// 避开 .next/cache (root:root 0755,build 时创建,portal 写不进去)
const KEYPAIR_CACHE_DIR = "/var/lib/wdg-portal-cache"
const KEYPAIR_CACHE_FILE = `${KEYPAIR_CACHE_DIR}/wdg-agent-keypair.json`

const fs = require('fs')
const path = require('path')

async function getJose() {
  return await import('jose')
}

async function loadKeyPairFromDisk() {
  try {
    if (!fs.existsSync(KEYPAIR_CACHE_FILE)) return null
    const raw = fs.readFileSync(KEYPAIR_CACHE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed.privateKeyPem || !parsed.publicJwk) return null
    const jose = await getJose()
    const privateKey = await jose.importPKCS8(parsed.privateKeyPem, 'RS256')
    const publicKey = await jose.importJWK(parsed.publicJwk, 'RS256')
    return { privateKey, publicKey, publicJwk: parsed.publicJwk, kid: parsed.publicJwk.kid }
  } catch (e) {
    console.error('[agent-token] load keypair from disk failed:', e.message)
    return null
  }
}

async function saveKeyPairToDisk(privateKey, publicJwk) {
  try {
    if (!fs.existsSync(KEYPAIR_CACHE_DIR)) {
      fs.mkdirSync(KEYPAIR_CACHE_DIR, { recursive: true, mode: 0o700 })
    }
    const jose = await getJose()
    const privateKeyPem = await jose.exportPKCS8(privateKey)
    const payload = JSON.stringify({ privateKeyPem, publicJwk, savedAt: new Date().toISOString() })
    fs.writeFileSync(KEYPAIR_CACHE_FILE, payload, { mode: 0o600 })
    return true
  } catch (e) {
    console.error('[agent-token] save keypair to disk failed:', e.message)
    return false
  }
}

async function generateKeyPair() {
  const jose = await getJose()
  const { privateKey, publicKey } = await jose.generateKeyPair('RS256', {
    modulusLength: 2048,
    extractable: true,
  })
  const publicJwkRaw = await jose.exportJWK(publicKey)
  const kid = `portal-${Date.now()}`
  const publicJwk = { ...publicJwkRaw, kid, alg: 'RS256', use: 'sig' }
  // 持久化到磁盘
  await saveKeyPairToDisk(privateKey, publicJwk)
  return { privateKey, publicKey, publicJwk, kid }
}

async function getKeyPair() {
  const g = globalThis
  if (g[SLOT_KEY]) return g[SLOT_KEY]

  // 1) 优先从磁盘加载(portal 重启后保留 kid)
  const fromDisk = await loadKeyPairFromDisk()
  if (fromDisk) {
    g[SLOT_KEY] = fromDisk
    console.log('[agent-token] loaded keypair from disk, kid=', fromDisk.kid)
    return g[SLOT_KEY]
  }

  // 2) 磁盘无,生成新 keypair + 写盘
  const fresh = await generateKeyPair()
  g[SLOT_KEY] = fresh
  console.log('[agent-token] generated new keypair, kid=', fresh.kid)
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
