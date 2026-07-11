# WS 新协议迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Portal 前端 WS 客户端和 ChatShell 从旧协议（token 在 URL、`{conversationId, content}` 格式、`task_update/task_done` 事件）迁移到新协议（`auth` 帧握手、`{ type: 'user.message', payload: {...} }` 格式、Anthropic 流式事件）

**Architecture:** `useAgentSocket` 作为底层 WS 客户端暴露 `{ send, connState }` 和 `onEvent` 回调；`ChatShell` 用 reducer 把流式事件累积为 ContentBlock 数组；`MessageList` 按块渲染。最小化改动范围——不改 Composer、Sidebar、MarkdownView、StepList

**Tech Stack:** React, Next.js 14, Plain JS (当前无 TypeScript 编译)

## Global Constraints

- 不改动 Agent 端代码（Agent 已验证通）
- 不用 TypeScript（项目当前无 tsconfig，所有文件保持 `.js` / `.jsx`）
- 不引入新 npm 依赖
- 保持现有 UI 布局和 Tailwind 风格
- Composer、Sidebar、EmptyState、MarkdownView、FooterMenu 不改

---

### Task 1: 重写 `useAgentSocket.js` — 新协议 WS 客户端

**Files:**
- Modify: `src/lib/useAgentSocket.js` (完整替换)

**Interfaces:**
- Consumes: `/api/agent-token` (GET, 返回 `{ token, exp }`)
- Produces: `function useAgentSocket({ onEvent, onConnectionChange })` → `{ send }`
  - `onEvent(event)` — 接收所有非握手事件 (WsEvent 对象)
  - `onConnectionChange(state)` — state: `'connecting' | 'ok' | 'reconnecting' | 'failed'`
  - `send(msg)` — 发送消息，自动包装为 `user.message` 帧 + 生成 UUID messageId

- [ ] **Step 1: 写入完整新版本**

```js
// src/lib/useAgentSocket.js
import { useEffect, useRef } from 'react'

export const MAX_INPUT = 32000
const BACKOFF_MS = [3000, 6000, 12000, 24000, 48000, 60000]

// 新协议: token 放 auth 帧,不在 URL
// Agent 握手: client 发 { type: 'auth', payload: { token } }
// Agent 回: { type: 'hello', payload: { protocolVersion: 1, sessionId } }

let _wsUrl = null
function getWsUrl() {
  if (_wsUrl) return _wsUrl
  _wsUrl = process.env.NEXT_PUBLIC_AGENT_WS_URL || 'ws://localhost:4102'
  return _wsUrl
}

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
      const ws = new WebSocket(getWsUrl())
      wsRef.current = ws
      authedRef.current = false

      ws.onopen = () => {
        // 新协议: 第一帧发 auth
        try { ws.send(JSON.stringify({ type: 'auth', payload: { token } })) } catch {}
      }

      ws.onmessage = (ev) => {
        let data
        try { data = JSON.parse(ev.data) } catch { return }
        switch (data.type) {
          case 'hello':
            // 握手完成, flush 排队消息
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
            // 所有业务事件透明传递给 ChatShell
            onEventRef.current(data)
        }
      }

      ws.onclose = (ev) => {
        if (closedByUserRef.current) return
        if (ev.code === 4000) { // protocol_mismatch
          onConnRef.current('failed'); return
        }
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
```

- [ ] **Step 2: 验证** — 启动 dev server，确保编译无错误

---

### Task 2: 重写 `ChatShell.jsx` — 新协议事件处理 + ContentBlock reducer

**Files:**
- Modify: `src/components/chat/ChatShell.jsx` (核心逻辑重写)

**Interfaces:**
- Consumes: `useAgentSocket({ onEvent, onConnectionChange })` → `{ send }`
- Consumes: 现有 `/api/sessions`, `/api/apps`, `/api/sessions/:id/messages` API
- Produces: 传递给子组件的 `messages` 数组每条为 `{ id, role, status, content: ContentBlock[], stop_reason, usage }`

- [ ] **Step 1: 写入完整新版 ChatShell**

关键改动：
1. `import useAgentSocket from '../../lib/useAgentSocket'` — 调用改为 `useAgentSocket({ onEvent, onConnectionChange })`
2. `sendMessage` 中 `send(...)` 直接传 payload（useAgentSocket 内部包装 type+messageId）
3. `onEvent` 回调处理所有新协议事件，用 reducer 模式累积 ContentBlock 数组
4. user message id 用 `crypto.randomUUID()`
5. 历史消息加载兼容旧字符串 content

```jsx
// src/components/chat/ChatShell.jsx
import { useEffect, useState, useRef } from 'react'
import Sidebar from './Sidebar'
import MessageList from './MessageList'
import Composer from './Composer'
import EmptyState from './EmptyState'
import useAgentSocket from '../../lib/useAgentSocket'

function normalizeSession(s) {
  return {
    id: s.conversationId ?? s.id,
    brand: s.brand ?? null,
    title: s.title ?? '新会话',
    updated_at: s.lastActiveAt ?? s.updated_at,
  }
}

// 兼容: 旧版 messages 的 content 可能是字符串
// 旧版 message shape: { id, role, content: string, status, steps }
// 新版 message shape: { id, role, content: ContentBlock[], status, stop_reason, usage, clientMessageId }
function normalizeContent(content) {
  if (Array.isArray(content)) return content
  if (typeof content === 'string') return content ? [{ type: 'text', text: content }] : []
  return []
}

export default function ChatShell({ currentUser, isAdmin }) {
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [apps, setApps] = useState([])
  const [connState, setConnState] = useState('connecting')
  const justCreatedRef = useRef(false)

  // load sessions
  const loadSessions = async () => {
    try {
      const r = await fetch('/api/sessions', { credentials: 'include' })
      if (!r.ok) return
      const d = await r.json()
      if (Array.isArray(d)) setSessions(d.map(normalizeSession))
    } catch {}
  }
  useEffect(() => { loadSessions() }, [])

  // load apps
  const loadApps = async () => {
    try {
      const r = await fetch('/api/apps', { credentials: 'include' })
      if (r.ok) {
        const d = await r.json()
        setApps(Array.isArray(d) ? d : [])
      }
    } catch {}
  }
  useEffect(() => { loadApps() }, [])

  // load messages when active changes
  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    if (justCreatedRef.current) {
      justCreatedRef.current = false
      return
    }
    (async () => {
      try {
        const r = await fetch(`/api/sessions/${activeId}/messages`, { credentials: 'include' })
        if (!r.ok) { setMessages([]); return }
        const d = await r.json()
        const list = Array.isArray(d) ? d : (d?.messages ?? [])
        setMessages(list.map((m) => ({
          id: m.messageId ?? m.id,
          role: m.role,
          content: normalizeContent(m.content),
          status: m.status || 'done',
          stop_reason: m.stop_reason ?? null,
          usage: m.usage ?? null,
          createdAt: m.createdAt ?? m.created_at,
        })))
      } catch { setMessages([]) }
    })()
  }, [activeId])

  // ── WS 事件处理 ──
  useAgentSocket({
    onConnectionChange: setConnState,
    onEvent: (event) => {
      switch (event.type) {
        case 'ack': {
          setMessages((prev) => prev.map((m) =>
            m.role === 'user' && m.status === 'pending'
              ? { ...m, id: event.payload.messageId, status: 'sent' }
              : m
          ))
          break
        }
        case 'message_start': {
          const msg = event.payload.message || event.payload
          setMessages((prev) => [...prev, {
            id: msg.id,
            role: 'assistant',
            status: 'streaming',
            content: Array.isArray(msg.content) ? msg.content : [],
            stop_reason: msg.stop_reason ?? null,
            usage: msg.usage ?? null,
          }])
          break
        }
        case 'content_block_start': {
          const block = event.payload.content_block
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (!last || last.role !== 'assistant') return next
            next[next.length - 1] = {
              ...last,
              content: [...last.content, block],
            }
            return next
          })
          break
        }
        case 'content_block_delta': {
          const { index, delta } = event.payload
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (!last || !last.content[index]) return next
            const blocks = [...last.content]
            const block = { ...blocks[index] }
            if (delta.type === 'text_delta') {
              block.text = (block.text || '') + delta.text
            } else if (delta.type === 'thinking_delta') {
              block.thinking = (block.thinking || '') + delta.thinking
            } else if (delta.type === 'input_json_delta') {
              block.inputRaw = (block.inputRaw || '') + delta.partial_json
            }
            blocks[index] = block
            next[next.length - 1] = { ...last, content: blocks }
            return next
          })
          break
        }
        case 'content_block_stop': {
          // block 完成,无需特殊处理
          break
        }
        case 'message_delta': {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (!last) return next
            next[next.length - 1] = {
              ...last,
              stop_reason: event.payload.delta?.stop_reason ?? last.stop_reason,
              usage: event.payload.usage ?? last.usage,
            }
            return next
          })
          break
        }
        case 'message_stop': {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (!last) return next
            next[next.length - 1] = { ...last, status: 'done' }
            return next
          })
          break
        }
        case 'error': {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.status === 'streaming') {
              next[next.length - 1] = {
                ...last,
                status: 'error',
                content: [...last.content, {
                  type: 'text',
                  text: `[${event.payload.code}] ${event.payload.message}`,
                }],
              }
            }
            return next
          })
          break
        }
        case 'interrupted': {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last) next[next.length - 1] = { ...last, status: 'interrupted' }
            return next
          })
          break
        }
        default:
          break
      }
    },
  })

  const { send } = useAgentSocket({...}) // 同上,但在 React 中不能条件调用 hook — 用 ref 方式
```

等等——`useAgentSocket` 和之前的 `onEvent` 在同一个组件里调了两次 `useAgentSocket`。我需要重新组织。`useAgentSocket` 应该只调一次，同时返回 `send`。

让我简化方案：直接把 send 和事件处理放在同一个 useAgentSocket 调用中。ChatShell 只调一次 hook。

Let me rewrite this properly.<｜end▁of▁thinking｜>方案需要调整——不能调两次 `useAgentSocket`。重写为只调一次，`send` 来自 hook 返回值，`onEvent` 处理所有业务事件：

<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="Write">
<｜｜DSML｜｜parameter name="content" string="true"># WS 新协议迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Portal 前端从旧 WS 协议迁移到新协议——`auth` 帧握手、`user.message` 发送格式、Anthropic 流式事件接收（`message_start`/`content_block_delta`/`message_stop` 等）、ContentBlock 数组渲染

**Architecture:** 3 个文件改动：`useAgentSocket.js`（WS 层重写）、`ChatShell.jsx`（事件 reducer + 发送格式）、`MessageList.jsx`（块级渲染）。Composer/Sidebar/EmptyState 不改

**Tech Stack:** React, Next.js 14, Plain JS, Tailwind

## Global Constraints

- 不改 Agent 端
- 不用 TypeScript（项目无 tsconfig）
- 不新增 npm 依赖
- 保持现有 UI 布局风格

---

### Task 1: 重写 `useAgentSocket.js`

**Files:**
- Modify: `src/lib/useAgentSocket.js`

**Interfaces:**
- Consumes: `GET /api/agent-token` → `{ token, exp }`
- Produces: `useAgentSocket({ onEvent, onConnectionChange })` → `{ send }`
  - `onEvent(event: object)` — 透传所有非握手 WS 事件
  - `onConnectionChange(state: 'connecting'|'ok'|'reconnecting'|'failed')`
  - `send(payload: object)` — 自动包装 `{type:'user.message', payload:{...messageId:UUID}}`，未认证时入队

- [ ] **Step 1: 写入代码**

```js
// src/lib/useAgentSocket.js
import { useEffect, useRef } from 'react'

export const MAX_INPUT = 32000
const BACKOFF_MS = [3000, 6000, 12000, 24000, 48000, 60000]
const URL = process.env.NEXT_PUBLIC_AGENT_WS_URL || 'ws://localhost:4102'

// 新协议: token 放第一帧 { type:'auth', payload:{token} }, 不在 URL
// Agent 回 { type:'hello', payload:{protocolVersion:1, sessionId} }
// 之后 flush pending queue

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
```

- [ ] **Step 2: 启动验证**

```bash
# 确保编译无错误
PORT=6100 npm run dev
curl -s -o /dev/null -w "%{http_code}" http://localhost:6100/chat
# 预期: 200 (会重定向到 /login，但编译应成功)
```

---

### Task 2: 重写 `ChatShell.jsx` — 事件 reducer + 新发送格式

**Files:**
- Modify: `src/components/chat/ChatShell.jsx`

**Interfaces:**
- Consumes: `useAgentSocket({ onEvent, onConnectionChange })` → `{ send }`
- Consumes: `/api/sessions`, `/api/apps`, `/api/sessions/:id/messages`
- Produces: messages 数组每条 `{ id, role, status, content: ContentBlock[], stop_reason, usage, createdAt }`

- [ ] **Step 1: 写入完整新版 ChatShell**

```jsx
// src/components/chat/ChatShell.jsx
import { useEffect, useState, useRef, useCallback } from 'react'
import Sidebar from './Sidebar'
import MessageList from './MessageList'
import Composer from './Composer'
import EmptyState from './EmptyState'
import useAgentSocket from '../../lib/useAgentSocket'

function normalizeSession(s) {
  return {
    id: s.conversationId ?? s.id,
    brand: s.brand ?? null,
    title: s.title ?? '新会话',
    updated_at: s.lastActiveAt ?? s.updated_at,
  }
}

// 兼容旧版字符串 content → ContentBlock[]
function normalizeContent(content) {
  if (Array.isArray(content)) return content
  if (typeof content === 'string' && content) return [{ type: 'text', text: content }]
  return []
}

export default function ChatShell({ currentUser, isAdmin }) {
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [apps, setApps] = useState([])
  const [connState, setConnState] = useState('connecting')
  const [isStreaming, setIsStreaming] = useState(false)
  const justCreatedRef = useRef(false)
  // 上一次 sendMessage 的临时 messageId，ack 后替换
  const pendingUserMsgRef = useRef(null)

  // load sessions
  const loadSessions = async () => {
    try {
      const r = await fetch('/api/sessions', { credentials: 'include' })
      if (!r.ok) return
      const d = await r.json()
      if (Array.isArray(d)) setSessions(d.map(normalizeSession))
    } catch {}
  }
  useEffect(() => { loadSessions() }, [])

  // load apps
  const loadApps = async () => {
    try {
      const r = await fetch('/api/apps', { credentials: 'include' })
      if (r.ok) {
        const d = await r.json()
        setApps(Array.isArray(d) ? d : [])
      }
    } catch {}
  }
  useEffect(() => { loadApps() }, [])

  // load messages when active changes
  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    if (justCreatedRef.current) {
      justCreatedRef.current = false
      return
    }
    (async () => {
      try {
        const r = await fetch(`/api/sessions/${activeId}/messages`, { credentials: 'include' })
        if (!r.ok) { setMessages([]); return }
        const d = await r.json()
        const list = Array.isArray(d) ? d : (d?.messages ?? [])
        setMessages(list.map((m) => ({
          id: m.messageId ?? m.id,
          role: m.role,
          content: normalizeContent(m.content),
          status: m.status || 'done',
          stop_reason: m.stop_reason ?? null,
          usage: m.usage ?? null,
          createdAt: m.createdAt ?? m.created_at,
        })))
      } catch { setMessages([]) }
    })()
  }, [activeId])

  // ── WS 事件处理 (reducer-style) ──
  const onEvent = useCallback((event) => {
    switch (event.type) {
      case 'ack': {
        // 替换 pending user message 的临时 id
        const ackId = event.payload?.messageId
        if (ackId && pendingUserMsgRef.current) {
          setMessages((prev) => prev.map((m) =>
            m.id === pendingUserMsgRef.current ? { ...m, id: ackId, status: 'sent' } : m
          ))
          pendingUserMsgRef.current = null
        }
        break
      }
      case 'message_start': {
        const msg = event.payload?.message || event.payload
        setIsStreaming(true)
        setMessages((prev) => [...prev, {
          id: msg.id,
          role: 'assistant',
          status: 'streaming',
          content: [],
          stop_reason: null,
          usage: null,
        }])
        break
      }
      case 'content_block_start': {
        const block = event.payload?.content_block
        if (!block) break
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (!last || last.role !== 'assistant') return next
          next[next.length - 1] = { ...last, content: [...last.content, block] }
          return next
        })
        break
      }
      case 'content_block_delta': {
        const { index, delta } = event.payload || {}
        if (delta == null) break
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (!last || !last.content[index]) return next
          const blocks = [...last.content]
          const block = { ...blocks[index] }
          if (delta.type === 'text_delta') block.text = (block.text || '') + delta.text
          else if (delta.type === 'thinking_delta') block.thinking = (block.thinking || '') + delta.thinking
          else if (delta.type === 'input_json_delta') block.input = (block.input || '') + delta.partial_json
          blocks[index] = block
          next[next.length - 1] = { ...last, content: blocks }
          return next
        })
        break
      }
      case 'content_block_stop':
        break
      case 'message_delta': {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (!last) return next
          next[next.length - 1] = {
            ...last,
            stop_reason: event.payload?.delta?.stop_reason ?? last.stop_reason,
            usage: event.payload?.usage ?? last.usage,
          }
          return next
        })
        break
      }
      case 'message_stop': {
        setIsStreaming(false)
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (!last) return next
          next[next.length - 1] = { ...last, status: 'done' }
          return next
        })
        break
      }
      case 'error': {
        setIsStreaming(false)
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.status === 'streaming') {
            next[next.length - 1] = {
              ...last,
              status: 'error',
              content: [...last.content, {
                type: 'text',
                text: `[${event.payload?.code || 'error'}] ${event.payload?.message || '未知错误'}`,
              }],
            }
          } else {
            next.push({
              id: crypto.randomUUID(),
              role: 'assistant',
              status: 'error',
              content: [{ type: 'text', text: `[${event.payload?.code || 'error'}] ${event.payload?.message || '未知错误'}` }],
              stop_reason: null,
              usage: null,
            })
          }
          return next
        })
        break
      }
      case 'interrupted': {
        setIsStreaming(false)
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last) next[next.length - 1] = { ...last, status: 'interrupted' }
          return next
        })
        break
      }
      default:
        break
    }
  }, [])

  const { send } = useAgentSocket({ onEvent, onConnectionChange: setConnState })

  const sendMessage = async ({ content, brand, attachments = [] }) => {
    const clientMsgId = crypto.randomUUID()
    pendingUserMsgRef.current = clientMsgId
    setMessages((m) => [...m, {
      id: clientMsgId,
      role: 'user',
      content: [{ type: 'text', text: content }],
      status: 'pending',
      stop_reason: null,
      usage: null,
    }])
    setIsStreaming(true)

    let convId = activeId
    if (!convId) {
      try {
        const r = await fetch('/api/sessions', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (!r.ok) throw new Error('session_create_failed')
        const s = await r.json()
        const norm = normalizeSession(s)
        convId = norm.id
        setSessions((arr) => [norm, ...arr])
        justCreatedRef.current = true
        setActiveId(convId)
      } catch {
        setIsStreaming(false)
        setMessages((m) => m.map((msg) =>
          msg.id === clientMsgId ? { ...msg, status: 'error' } : msg
        ))
        return
      }
    }

    send({
      conversationId: convId,
      content,
      brand: brand || null,
      attachments: (attachments || []).map((a) => ({
        type: 'file',
        uploadId: a.uploadId,
        fileName: a.fileName,
        mimeType: a.mimeType,
        size: a.size,
      })),
    })
  }

  const onCreate = async () => {
    const r = await fetch('/api/sessions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!r.ok) return
    const s = await r.json()
    const norm = normalizeSession(s)
    setSessions((arr) => [norm, ...arr])
    setActiveId(norm.id)
  }

  const onRename = async (id, title) => {
    const r = await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    if (!r.ok) return
    const d = await r.json().catch(() => null)
    const newTitle = d?.title ?? title
    setSessions((arr) => arr.map((s) => s.id === id ? { ...s, title: newTitle } : s))
  }

  const onDelete = async (id) => {
    const r = await fetch(`/api/sessions/${id}`, { method: 'DELETE', credentials: 'include' })
    if (!r.ok && r.status !== 204) return
    setSessions((arr) => {
      const next = arr.filter((s) => s.id !== id)
      if (activeId === id) setActiveId(next[0]?.id ?? null)
      return next
    })
  }

  const onOpenAdmin = () => { window.location.href = '/admin' }
  const onOpenApp = (url) => { window.open(url, '_blank', 'noopener,noreferrer') }

  const hasMessages = messages.length > 0

  return (
    <div className="chat-root h-screen overflow-hidden flex bg-paper">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={(id) => { setActiveId(id); setMobileOpen(false) }}
        onCreate={onCreate}
        onRename={onRename}
        onDelete={onDelete}
        isAdmin={isAdmin}
        onOpenAdmin={onOpenAdmin}
        currentUser={currentUser}
        apps={apps}
        onOpenApp={onOpenApp}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogout={async () => {
          await fetch('/api/auth/dev-logout', { method: 'POST', credentials: 'include' })
          window.location.href = '/login'
        }}
      />
      <div className="flex-1 min-h-0 h-full flex flex-col">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden p-3 -ml-3 text-ink hover:bg-hover -mr-3"
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <header className="shrink-0 border-b border-line px-6 py-3 text-sm text-muted bg-paper flex items-center justify-between">
          <span>
            {connState === 'ok' ? '已连接' :
             connState === 'reconnecting' ? '重连中…' :
             connState === 'failed' ? '连接失败' : '连接中…'}
          </span>
          {!activeId && <span className="text-xs text-claude">点 sidebar「+ 新建」开始</span>}
        </header>
        {!hasMessages
          ? <EmptyState onPick={(c) => sendMessage({ content: c, brand: null })} />
          : <MessageList
              messages={messages}
              isStreaming={isStreaming}
            />
        }
        <Composer
          onSend={sendMessage}
          disabled={isStreaming || !activeId}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证编译**

```bash
# 确保页面编译无错
curl -s -o /dev/null -w "%{http_code}" http://localhost:6100/chat
# 预期: 307 或 200
```

---

### Task 3: 重写 `MessageList.jsx` — ContentBlock 块级渲染

**Files:**
- Modify: `src/components/chat/MessageList.jsx`

**Interfaces:**
- Consumes: `messages` 数组（每条 `{ id, role, status, content: ContentBlock[] }`），`isStreaming` 布尔值

- [ ] **Step 1: 写入代码**

```jsx
// src/components/chat/MessageList.jsx
import { useEffect, useRef } from 'react'
import MarkdownView from './MarkdownView'

function AssistantAvatar() {
  return (
    <div className="shrink-0 w-7 h-7 rounded-lg bg-claude/10 flex items-center justify-center text-claude text-sm mt-0.5">
      ✦
    </div>
  )
}

function StreamingCursor() {
  return (
    <span className="inline-block w-1.5 h-4 ml-0.5 bg-claude/70 align-text-bottom animate-pulse" style={{ verticalAlign: '-2px' }} />
  )
}

// 渲染单个 ContentBlock
function ContentBlockView({ block }) {
  switch (block.type) {
    case 'text':
      return (
        <div className="chat-markdown text-ink leading-relaxed">
          <MarkdownView>{block.text || ''}</MarkdownView>
        </div>
      )
    case 'thinking':
      return (
        <details className="mb-2 group">
          <summary className="inline-flex items-center gap-1.5 text-xs text-muted cursor-pointer hover:text-ink list-none">
            <span className="w-1.5 h-1.5 rounded-full bg-claude/60" />
            <span>思考过程</span>
            <span className="opacity-60 group-open:rotate-90 transition-transform">▸</span>
          </summary>
          <div className="mt-2 pl-3 border-l-2 border-claude/20 text-xs text-muted italic leading-relaxed whitespace-pre-wrap">
            {block.thinking || ''}
          </div>
        </details>
      )
    case 'tool_use':
      return (
        <details className="mb-2 group">
          <summary className="inline-flex items-center gap-1.5 text-xs text-claude cursor-pointer hover:underline list-none">
            <span>🔧</span>
            <span className="font-medium">{block.name || '工具调用'}</span>
          </summary>
          <div className="mt-1.5 pl-6 text-xs text-muted">
            <pre className="bg-hover rounded-lg p-2 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap">
              {typeof block.input === 'string' ? block.input : JSON.stringify(block.input, null, 2)}
            </pre>
          </div>
        </details>
      )
    case 'tool_result':
      return (
        <details className="mb-2 group">
          <summary className="inline-flex items-center gap-1.5 text-xs text-muted cursor-pointer hover:text-ink list-none">
            <span>📋</span>
            <span>工具结果{block.is_error ? ' (错误)' : ''}</span>
            <span className="opacity-60 group-open:rotate-90 transition-transform">▸</span>
          </summary>
          <div className="mt-1.5 pl-6 text-xs text-muted">
            <pre className="bg-hover rounded-lg p-2 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap">
              {typeof block.content === 'string' ? block.content : JSON.stringify(block.content, null, 2)}
            </pre>
          </div>
        </details>
      )
    default:
      return null
  }
}

export default function MessageList({ messages, isStreaming = false }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, isStreaming])

  return (
    <div ref={ref} className="flex-1 min-h-0 overflow-y-auto px-6 py-8 bg-paper">
      <div className="max-w-[720px] mx-auto space-y-6">
        {messages.map((m, i) => {
          const isUser = m.role === 'user'
          const isLast = i === messages.length - 1
          const isStreamingAssistant = !isUser && m.status === 'streaming' && isLast

          if (isUser) {
            // 提取文本内容用于显示
            const textBlocks = (m.content || []).filter(b => b.type === 'text')
            const text = textBlocks.map(b => b.text).join('')
            return (
              <div key={m.id ?? i} className="flex justify-end">
                <div className="bg-hover text-ink rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[80%] text-sm whitespace-pre-wrap">
                  {text}
                  {m.status === 'pending' && <span className="text-muted ml-1">…</span>}
                </div>
              </div>
            )
          }

          // assistant message
          const hasContent = (m.content || []).length > 0
          return (
            <div key={m.id ?? i} className="flex gap-3 items-start">
              <AssistantAvatar />
              <div className="flex-1 min-w-0 text-ink text-[15px] leading-7">
                {hasContent ? (
                  (m.content || []).map((block, bi) => (
                    <ContentBlockView key={bi} block={block} />
                  ))
                ) : (
                  isStreamingAssistant ? (
                    <p className="text-sm text-muted italic">
                      <StreamingCursor />
                    </p>
                  ) : (
                    <p className="text-sm text-muted italic">无回复内容</p>
                  )
                )}
                {isStreamingAssistant && hasContent && <StreamingCursor />}
                {m.status === 'error' && (
                  <p className="mt-2 text-xs text-claude">⚠ 回复出错</p>
                )}
                {m.status === 'interrupted' && (
                  <p className="mt-2 text-xs text-muted">⏹ 已停止</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 删除不再需要的导入**

`MessageList.jsx` 不再需要 `StepList` 组件的导入——删除该 import 行。

- [ ] **Step 3: 验证编译**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:6100/chat
# 预期: 编译成功
```

---

### Task 4: 端到端测试

- [ ] **Step 1: Playwright 测试完整发送→接收流程**

```js
// scripts/verify-chat-e2e.mjs
import { chromium } from 'playwright';
const BASE = 'http://localhost:6100';
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const setup = await ctx.newPage();
  await setup.goto(BASE, { waitUntil: 'commit' });
  await setup.evaluate(async (base) => {
    await fetch(base + '/api/auth/dev-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'e2euser', role: 'admin' })
    });
  }, BASE);
  await setup.close();

  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(BASE + '/chat', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  // 找到 textarea 并发送消息
  const textarea = await page.$('textarea');
  if (!textarea) { console.log('❌ 没有找到 textarea'); process.exit(1); }
  console.log('✅ Textarea found');

  await textarea.fill('你好');
  await page.keyboard.press('Enter');
  console.log('Sent: 你好');

  // 等待响应
  await page.waitForTimeout(10000);

  const body = await page.textContent('body');
  const hasResponse = body.includes('你好') && body.includes('很高兴') || body.includes('可以帮你');
  console.log(hasResponse ? '✅ Agent 已回复' : '⚠️ 未检测到回复');

  await page.screenshot({ path: '/Users/ericmr/Documents/GitHub/WGD_Portal/chat-e2e-verify.png', fullPage: true });
  console.log('Screenshot saved');

  console.log('\n═══════════════════════════════════');
  console.log(errors.length ? '❌ 有 JS 错误: ' + errors.join('\n') : '✅ 无 JS 错误');
  console.log('═══════════════════════════════════');
} finally {
  await browser.close();
}
```

- [ ] **Step 2: 运行测试**

```bash
node scripts/verify-chat-e2e.mjs
# 预期: Agent 回复文本可见，无 JS 错误
```

---

### Task 5: 清理

- [ ] **Step 1: 删除未使用的 StepList 导入**

检查 `MessageList.jsx` 和 `ChatShell.jsx` 是否正确移除了 `StepList` 相关引用（`StepList` 组件保留不删，Sidebar 可能用到）。

- [ ] **Step 2: 全局检查没有残留的旧 API 调用**

```bash
grep -rn 'task_update\|task_done\|system_error\|streamingSteps\|setStreamingSteps' src/components/ --include='*.jsx' --include='*.js'
# 预期: 无输出 (ChatShell 不再使用这些旧事件类型)
```
