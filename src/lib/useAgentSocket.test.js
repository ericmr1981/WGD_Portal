// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// mock global WebSocket
class FakeWS {
  constructor(url) {
    this.url = url
    FakeWS.instances.push(this)
    this.readyState = 0 // CONNECTING
    this.sent = []
    this.listeners = {}
  }
  send(data) {
    this.sent.push(data)
  }
  close() {
    this.readyState = 3
    this._fire('close', { code: 1000, reason: 'normal' })
  }
  _fire(type, ev) {
    this.listeners[type]?.(ev)
  }
  set onopen(fn) { this.listeners.open = fn }
  set onmessage(fn) { this.listeners.message = fn }
  set onclose(fn) { this.listeners.close = fn }
  set onerror(fn) { this.listeners.error = fn }
}

global.WebSocket = FakeWS

const fakeFetch = vi.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ token: 'T', exp: 9999 }) }),
)
global.fetch = fakeFetch

beforeEach(() => {
  FakeWS.instances = []
  fakeFetch.mockClear()
})

describe('clampInput', () => {
  it('returns text unchanged when under limit', async () => {
    const { clampInput } = await import('./useAgentSocket.js')
    const r = clampInput('hi')
    expect(r.text).toBe('hi')
    expect(r.oversize).toBe(false)
  })

  it('truncates and reports oversize when over limit', async () => {
    const { clampInput } = await import('./useAgentSocket.js')
    const r = clampInput('x'.repeat(33000))
    expect(r.text.length).toBe(32000)
    expect(r.oversize).toBe(true)
  })
})

describe('defaultUseAgentSocket', () => {
  it('fetches token and opens WS with it', async () => {
    const { default: useAgentSocket } = await import('./useAgentSocket.js')
    renderHook(() => useAgentSocket({}))
    await waitFor(() => expect(FakeWS.instances.length).toBe(1))
    const ws = FakeWS.instances[0]
    expect(ws.url).toMatch(/\?token=T/)
  })

  it('dispatches task_update and task_done', async () => {
    const onUpdate = vi.fn()
    const onDone = vi.fn()
    const { default: useAgentSocket } = await import('./useAgentSocket.js')
    renderHook(() => useAgentSocket({ onUpdate, onDone }))
    await waitFor(() => expect(FakeWS.instances.length).toBe(1))
    const ws = FakeWS.instances[0]
    act(() => {
      ws.listeners.message?.({ data: JSON.stringify({ type: 'task_update', payload: { delta: 'hi' } }) })
      ws.listeners.message?.({ data: JSON.stringify({ type: 'task_done', payload: { content: 'done' } }) })
    })
    expect(onUpdate).toHaveBeenCalledWith({ delta: 'hi' })
    expect(onDone).toHaveBeenCalledWith({ content: 'done' })
  })

  it('dispatches system_error to onError', async () => {
    const onError = vi.fn()
    const { default: useAgentSocket } = await import('./useAgentSocket.js')
    renderHook(() => useAgentSocket({ onError }))
    await waitFor(() => expect(FakeWS.instances.length).toBe(1))
    const ws = FakeWS.instances[0]
    act(() => {
      ws.listeners.message?.({ data: JSON.stringify({ type: 'system_error', payload: { code: 'X' } }) })
    })
    expect(onError).toHaveBeenCalledWith({ code: 'X' })
  })

  it('ignores unknown message types', async () => {
    const onUpdate = vi.fn()
    const { default: useAgentSocket } = await import('./useAgentSocket.js')
    renderHook(() => useAgentSocket({ onUpdate }))
    await waitFor(() => expect(FakeWS.instances.length).toBe(1))
    const ws = FakeWS.instances[0]
    act(() => {
      ws.listeners.message?.({ data: JSON.stringify({ type: 'something_else' }) })
    })
    expect(onUpdate).not.toHaveBeenCalled()
  })
})
