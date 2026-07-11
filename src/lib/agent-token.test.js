import { describe, it, expect } from 'vitest'
import { jwtVerify } from 'jose'

describe('signAgentToken (RS256)', () => {
  it('returns an RS256 token containing sub and exp', async () => {
    const { signAgentToken, getAgentJWKS } = await import('./agent-token.ts')
    const { token, exp } = await signAgentToken('user-123')
    expect(token).toBeTruthy()
    const jwks = await getAgentJWKS()
    const key = await importJWK(jwks.keys[0], 'RS256')
    const { payload } = await jwtVerify(token, key, { algorithms: ['RS256'] })
    expect(payload.sub).toBe('user-123')
    expect(payload.exp).toBe(exp)
  })

  it('throws when userId is empty', async () => {
    const { signAgentToken } = await import('./agent-token.ts')
    await expect(signAgentToken('')).rejects.toThrow(/userId/)
    await expect(signAgentToken(null as any)).rejects.toThrow(/userId/)
  })

  it('exposes a JWKS with RS256 public key', async () => {
    const { getAgentJWKS } = await import('./agent-token.ts')
    const jwks = await getAgentJWKS()
    expect(jwks.keys).toBeInstanceOf(Array)
    expect(jwks.keys.length).toBeGreaterThan(0)
    expect(jwks.keys[0].kty).toBe('RSA')
    expect(jwks.keys[0].alg).toBe('RS256')
    expect(jwks.keys[0].use).toBe('sig')
    expect(typeof jwks.keys[0].kid).toBe('string')
  })
})

// 需要 importJWK 的 ES import 在顶层
import { importJWK } from 'jose'