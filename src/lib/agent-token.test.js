import { describe, it, expect, beforeAll } from 'vitest'
import jwt from 'jsonwebtoken'

beforeAll(() => {
  process.env.SUPABASE_JWT_SECRET = 'unit-test-secret'
})

describe('signAgentToken', () => {
  it('returns a HS256 token containing sub and exp', async () => {
    const { signAgentToken } = await import('./agent-token.js')
    const { token, exp } = signAgentToken('user-123')
    expect(token).toBeTruthy()
    const decoded = jwt.verify(token, 'unit-test-secret', { algorithms: ['HS256'] })
    expect(decoded.sub).toBe('user-123')
    expect(decoded.exp).toBe(exp)
  })

  it('throws when SUPABASE_JWT_SECRET is missing', async () => {
    const original = process.env.SUPABASE_JWT_SECRET
    delete process.env.SUPABASE_JWT_SECRET
    const { signAgentToken } = await import('./agent-token.js?v=missing')
    expect(() => signAgentToken('user-x')).toThrow(/SUPABASE_JWT_SECRET/)
    process.env.SUPABASE_JWT_SECRET = original
  })

  it('throws when userId is empty', async () => {
    const { signAgentToken } = await import('./agent-token.js?v=uid')
    expect(() => signAgentToken('')).toThrow(/userId/)
    expect(() => signAgentToken(null)).toThrow(/userId/)
  })
})
