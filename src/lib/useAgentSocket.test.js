// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

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
  Promise.resolve({ ok: true, json: () => Promise.resolve({ token: 'T' }) }),
)
global.fetch = fakeFetch

beforeEach(() => {
  FakeWS.instances = []
  fakeFetch.mockClear()
  vi.resetModules()
})

describe('useAgentSocket', () => {
  it('fetches token and opens WebSocket on mount', async () => {
    const { default: useAgentSocket } = await import('./useAgentSocket.js')
    renderHook(() => useAgentSocket())
    await waitFor(() => expect(FakeWS.instances.length).toBe(1))
    const ws = FakeWS.instances[0]
    expect(fakeFetch).toHaveBeenCalledWith('/api/agent-token', { credentials: 'include' })
    expect(ws.url).toBe('ws://localhost:4102')
  })

  it('sends auth message on open', async () => {
    const { default: useAgentSocket } = await import('./useAgentSocket.js')
    renderHook(() => useAgentSocket())
    await waitFor(() => expect(FakeWS.instances.length).toBe(1))
    const ws = FakeWS.instances[0]
    act(() => { ws._fire('open', {}) })
    expect(ws.sent.length).toBe(1)
    expect(JSON.parse(ws.sent[0])).toEqual({ type: 'auth', payload: { token: 'T' } })
  })

  it('calls onConnectionChange("ok") on hello and flushes pending queue', async () => {
    const onConn = vi.fn()
    const { default: useAgentSocket } = await import('./useAgentSocket.js')
    const { result } = renderHook(() => useAgentSocket({ onConnectionChange: onConn }))
    await waitFor(() => expect(FakeWS.instances.length).toBe(1))
    const ws = FakeWS.instances[0]

    // Queue a message before auth
    act(() => { result.current.send({ text: 'hello' }) })

    // Auth handshake
    act(() => { ws._fire('open', {}) })
    act(() => { ws._fire('message', { data: JSON.stringify({ type: 'hello' }) }) })

    expect(onConn).toHaveBeenCalledWith('ok')
    // After hello, pending message should be flushed
    expect(ws.sent.length).toBe(2) // auth + user.message
    expect(JSON.parse(ws.sent[1]).type).toBe('user.message')
  })

  it('responds to ping with pong', async () => {
    const { default: useAgentSocket } = await import('./useAgentSocket.js')
    renderHook(() => useAgentSocket())
    await waitFor(() => expect(FakeWS.instances.length).toBe(1))
    const ws = FakeWS.instances[0]
    act(() => {
      ws._fire('open', {})
      ws._fire('message', { data: JSON.stringify({ type: 'hello' }) })
      ws._fire('message', { data: JSON.stringify({ type: 'ping' }) })
    })
    const pongMsg = ws.sent.find(s => {
      try { return JSON.parse(s).type === 'pong' } catch { return false }
    })
    expect(pongMsg).toBeTruthy()
    expect(JSON.parse(pongMsg).payload.ts).toBeGreaterThan(0)
  })

  it('forwards non-control messages to onEvent', async () => {
    const onEvent = vi.fn()
    const { default: useAgentSocket } = await import('./useAgentSocket.js')
    renderHook(() => useAgentSocket({ onEvent }))
    await waitFor(() => expect(FakeWS.instances.length).toBe(1))
    const ws = FakeWS.instances[0]
    act(() => {
      ws._fire('open', {})
      ws._fire('message', { data: JSON.stringify({ type: 'hello' }) }) // control — ignored by onEvent
      ws._fire('message', { data: JSON.stringify({ type: 'task_update', payload: { delta: 'hi' } }) })
    })
    // hello is swallowed; task_update reaches onEvent
    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith({ type: 'task_update', payload: { delta: 'hi' } })
  })

  it('queues messages sent before auth is complete', async () => {
    const { default: useAgentSocket } = await import('./useAgentSocket.js')
    const { result } = renderHook(() => useAgentSocket())
    await waitFor(() => expect(FakeWS.instances.length).toBe(1))
    act(() => { result.current.send({ text: 'queued' }) })
    // Not yet authed — nothing should be on the wire beyond what connect() sends
    expect(FakeWS.instances[0].sent.length).toBe(0)
  })

  it('calls onConnectionChange("reconnecting") on close (non-4000)', async () => {
    const onConn = vi.fn()
    const { default: useAgentSocket } = await import('./useAgentSocket.js')
    renderHook(() => useAgentSocket({ onConnectionChange: onConn }))
    await waitFor(() => expect(FakeWS.instances.length).toBe(1))
    const ws = FakeWS.instances[0]

    act(() => { ws._fire('close', { code: 1001, reason: 'going away' }) })
    expect(onConn).toHaveBeenCalledWith('reconnecting')
  })

  it('calls onConnectionChange("failed") on close with code 4000', async () => {
    const onConn = vi.fn()
    const { default: useAgentSocket } = await import('./useAgentSocket.js')
    renderHook(() => useAgentSocket({ onConnectionChange: onConn }))
    await waitFor(() => expect(FakeWS.instances.length).toBe(1))
    const ws = FakeWS.instances[0]

    act(() => { ws._fire('close', { code: 4000, reason: 'bad token' }) })
    expect(onConn).toHaveBeenCalledWith('failed')
  })

  it('closes WebSocket on unmount', async () => {
    const { default: useAgentSocket } = await import('./useAgentSocket.js')
    const { unmount } = renderHook(() => useAgentSocket())
    await waitFor(() => expect(FakeWS.instances.length).toBe(1))
    const ws = FakeWS.instances[0]
    unmount()
    expect(ws.readyState).toBe(3) // CLOSED
  })
})
