// src/lib/useAgentSocket.js
import { useEffect, useRef } from 'react'

export const MAX_INPUT = 32000
const BACKOFF_MS = [3000, 6000, 12000, 24000, 48000, 60000]
const URL = process.env.NEXT_PUBLIC_AGENT_WS_URL || 'ws://localhost:4102'

export function useAgentSocket({
  onEvent = () => {},
  onConnectionChange = () => {},
} = {}) {
  const wsRef = useRef(null)
  const attemptRef = useRef(0)
  const closedByUserRef = useRef(false)
  const pendingRef = useRef([])
  const authedRef = useRef(false)
  const onEventRef = useRef(onEvent)
  const onConnRef = useRef(onConnectionChange)

  useEffect(() => { onEventRef.current = onEvent }, [onEvent])
  useEffect(() => { onConnRef.current = onConnectionChange }, [onConnectionChange])

  const connect = async () => {
    try {
      const res = await fetch('/api/agent-token', { credentials: 'include' })
      if (!res.ok) { onConnRef.current('failed'); return }
      const { token } = await res.json()
      const ws = new WebSocket(URL)
      wsRef.current = ws
      authedRef.current = false

      ws.onopen = () => {
        try { ws.send(JSON.stringify({ type: 'auth', payload: { token } })) } catch {}
      }

      ws.onmessage = (ev) => {
        let data
        try { data = JSON.parse(ev.data) } catch { return }
        switch (data.type) {
          case 'hello':
            authedRef.current = true
            attemptRef.current = 0
            onConnRef.current('ok')
            const queue = pendingRef.current
            pendingRef.current = []
            for (const msg of queue) {
              try { ws.send(JSON.stringify(msg)) } catch {}
            }
            break
          case 'ping':
            try { ws.send(JSON.stringify({ type: 'pong', payload: { ts: Date.now() } })) } catch {}
            break
          case 'pong':
            break
          default:
            onEventRef.current(data)
        }
      }

      ws.onclose = (ev) => {
        if (closedByUserRef.current) return
        if (ev.code === 4000) { onConnRef.current('failed'); return }
        onConnRef.current('reconnecting')
        const idx = Math.min(attemptRef.current, BACKOFF_MS.length - 1)
        attemptRef.current += 1
        setTimeout(() => { if (!closedByUserRef.current) connect() }, BACKOFF_MS[idx])
      }

      ws.onerror = () => { onConnRef.current('reconnecting') }
    } catch {
      onConnRef.current('failed')
    }
  }

  useEffect(() => {
    connect()
    return () => {
      closedByUserRef.current = true
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [])

  const send = (payload) => {
    const frame = {
      type: 'user.message',
      payload: {
        ...payload,
        messageId: payload.messageId || crypto.randomUUID(),
      },
    }
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN && authedRef.current) {
      try { ws.send(JSON.stringify(frame)) } catch {}
    } else {
      pendingRef.current.push(frame)
    }
  }

  return { send }
}

export default useAgentSocket
