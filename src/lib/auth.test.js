import { describe, it, expect } from 'vitest'
import { getCurrentUser } from './auth.js'

describe('getCurrentUser', () => {
  it('returns null when no cookie header', () => {
    const req = { headers: {} }
    expect(getCurrentUser(req)).toBeNull()
  })

  it('returns null when cookie has no wgd_session', () => {
    const req = { headers: { cookie: 'other=value' } }
    expect(getCurrentUser(req)).toBeNull()
  })

  it('parses wgd_session JSON cookie', () => {
    const session = { id: 'u1', username: 'alice', name: 'Alice', role: 'user' }
    const encoded = encodeURIComponent(JSON.stringify(session))
    const req = { headers: { cookie: `wgd_session=${encoded}` } }
    expect(getCurrentUser(req)).toEqual({ id: 'u1', username: 'alice', role: 'user' })
  })

  it('returns null for malformed JSON', () => {
    const req = { headers: { cookie: 'wgd_session=not-json' } }
    expect(getCurrentUser(req)).toBeNull()
  })
})
