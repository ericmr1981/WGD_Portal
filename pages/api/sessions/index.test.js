import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock supabase server client
vi.mock('../../../src/lib/supabase.js', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}))

import { supabase } from '../../../src/lib/supabase.js'

const buildReq = (method, body = {}, cookie = '') => {
  // cookie must look like "wgd_session=<encoded JSON>"
  let real = cookie
  if (cookie === 'session') {
    real = encodeURIComponent(
      JSON.stringify({ id: 'u1', username: 'alice', name: 'Alice', role: 'user' }),
    )
    real = `wgd_session=${real}`
  }
  return {
    method,
    body,
    headers: { cookie: real },
    query: {},
  }
}

const buildRes = () => {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/sessions', () => {
  it('returns 401 when no session', async () => {
    const handler = (await import('./index.js')).default
    const res = buildRes()
    await handler(buildReq('GET'), res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('returns 200 with user sessions', async () => {
    const orderMock = {
      data: [{ id: 's1', brand: null, title: 't', updated_at: '2026-07-06T00:00:00Z' }],
      error: null,
    }
    supabase.from.mockReturnValue({
      select: () => ({ eq: () => ({ order: () => Promise.resolve(orderMock) }) }),
    })
    const handler = (await import('./index.js')).default
    const res = buildRes()
    await handler(buildReq('GET', {}, 'session'), res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith([
      { id: 's1', brand: null, title: 't', updated_at: '2026-07-06T00:00:00Z' },
    ])
  })

  it('returns 500 on supabase error', async () => {
    supabase.from.mockReturnValue({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'db dead' } }) }) }),
    })
    const handler = (await import('./index.js')).default
    const res = buildRes()
    await handler(buildReq('GET', {}, 'session'), res)
    expect(res.status).toHaveBeenCalledWith(500)
  })
})

describe('POST /api/sessions', () => {
  it('returns 401 when no session', async () => {
    const handler = (await import('./index.js')).default
    const res = buildRes()
    await handler(buildReq('POST'), res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('creates a session and returns 201', async () => {
    const inserted = { id: 'snew', brand: '蜜可诗', title: '新会话', created_at: '2026-07-06T00:00:00Z' }
    supabase.from.mockReturnValue({
      insert: () => ({
        select: () => ({ single: () => Promise.resolve({ data: inserted, error: null }) }),
      }),
    })
    const handler = (await import('./index.js')).default
    const res = buildRes()
    await handler(buildReq('POST', { brand: '蜜可诗' }, 'session'), res)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(inserted)
  })
})
