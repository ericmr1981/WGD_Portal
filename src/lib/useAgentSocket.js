import { useEffect, useRef } from 'react'

export const MAX_INPUT = 32000
const URL = process.env.NEXT_PUBLIC_AGENT_WS_URL || 'ws://localhost:4102'
const BACKOFF_MS = [3000, 6000, 12000, 24000, 48000, 60000]

export function clampInput(text) {
  if (text.length > MAX_INPUT) {
    return { text: text.slice(0, MAX_INPUT), oversize: true }
  }
  return { text, oversize: false }
}

export function defaultUseAgentSocket({
export { defaultUseAgentSocket as useAgentSocket }
  onUpdate = () => {},
  onDone = () => {},
  onError = () => {},
  onConnectionChange = () => {},
} = {}) {
  const wsRef = useRef(null)
  const attemptRef = useRef(0)
  const closedByUserRef = useRef(false)
  // 等待 WS OPEN 期间入队的消息
  const pendingRef = useRef([])

  const flushPending = () => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== 1) return
    while (pendingRef.current.length > 0) {
      ws.send(JSON.stringify(pendingRef.current.shift()))
    }
  }

  const connect = async () => {
    try {
      const res = await fetch('/api/agent-token', { credentials: 'include' })
      if (!res.ok) {
        onConnectionChange('failed')
        return
      }
      const { token } = await res.json()
      const ws = new WebSocket(`${URL}?token=${encodeURIComponent(token)}`)
      wsRef.current = ws

      ws.onopen = () => {
        attemptRef.current = 0
        onConnectionChange('ok')
        flushPending()
      }
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          if (data.type === 'task_update') onUpdate(data.payload)
          else if (data.type === 'task_done') onDone(data.payload)
          else if (data.type === 'system_error') onError(data.payload)
        } catch {
          /* ignore bad frames */
        }
      }
      ws.onclose = () => {
        if (closedByUserRef.current) return
        onConnectionChange('reconnecting')
        const idx = Math.min(attemptRef.current, BACKOFF_MS.length - 1)
        attemptRef.current += 1
        setTimeout(() => { connect() }, BACKOFF_MS[idx])
      }
      ws.onerror = () => {
        onConnectionChange('reconnecting')
      }
    } catch {
      onConnectionChange('failed')
    }
  }

  useEffect(() => {
    connect()
    return () => {
      closedByUserRef.current = true
      wsRef.current?.close?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = (msg) => {
    const ws = wsRef.current
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(msg))
    } else {
      // WS 还没 OPEN(CONNECTING)或者断线重连中 — 入队等 onopen flush
      pendingRef.current.push(msg)
    }
  }
  return { send }
}

export default defaultUseAgentSocket
