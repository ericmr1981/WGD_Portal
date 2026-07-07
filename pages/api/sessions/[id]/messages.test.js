import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../../src/lib/supabase.js', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}))

import { supabase } from '../../../../src/lib/supabase.js'

const buildReq = (cookie = '') => {
  let real = cookie
  if (cookie === 'session') {
    real = encodeURIComponent(
      JSON.stringify({ id: 'u1', username: 'alice', name: 'Alice', role: 'user' }),
    )
    real = `wgd_session=${real}`
  }
  return {
    method: 'GET',
    headers: { cookie: real },
    query: { id: 's1' },
  }
}
const buildRes = () => {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/sessions/[id]/messages', () => {
  it('returns 401 if unauth', async () => {
    const handler = (await import('./messages.js')).default
    const res = buildRes()
    await handler(buildReq(), res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('returns 403 if session not owned', async () => {
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
        }),
      }),
    })
    const handler = (await import('./messages.js')).default
    const res = buildRes()
    await handler(buildReq('session'), res)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('returns 200 with messages when session owned', async () => {
    const messages = [
      { id: 'm1', role: 'user', content: 'hi', status: null, created_at: '2026-07-06T00:00:00Z' },
    ]
    let call = 0
    supabase.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () =>
              call++ === 0
                ? Promise.resolve({ data: { id: 's1' }, error: null })
                : Promise.resolve({ data: null, error: null }),
          }),
          order: () => Promise.resolve({ data: messages, error: null }),
        }),
      }),
    }))
    const handler = (await import('./messages.js')).default
    const res = buildRes()
    await handler(buildReq('session'), res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(messages)
  })
})
