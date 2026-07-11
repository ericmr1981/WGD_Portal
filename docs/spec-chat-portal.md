# Spec B — Chat ↔ Agent 通讯(Portal/BFF 侧)

> 给 Portal 服务开发者(`WGD_Portal`,Next.js 14)
> 与 [spec-chat-agent.md](../wdg-data-foundation/docs/spec-chat-agent.md) 对齐使用
> 父计划:[../wdg-data-foundation/docs/chat-refactor-plan.md](../wdg-data-foundation/docs/chat-refactor-plan.md)

---

## B.1 范围

Portal 负责:
- 用户认证(沿用现有 Supabase cookie 体系)
- **HTTP 代理**到 Agent(`/api/sessions*` → Agent `/api/conversations*`)
- **WS 客户端**(`useAgentSocket`)按新协议解析 SDK 原始事件
- **新协议 UI 渲染**(text 块打字机、thinking 折叠、tool_use 卡片、refusal 提示)
- **取消 / 重试 / 编辑**消息交互
- **大附件上传**(走 Agent `/api/chat/upload`,不再 base64 拼文本)

---

## B.2 前端约束(对齐 Agent 行为)

### B.2.1 前端 message id

必须用 UUID v4,不用 timestamp:

```ts
// 旧
{ id: `tmp-${Date.now()}`, role: 'user', content }

// 新
{ id: crypto.randomUUID(), role: 'user', content }
```

服务端 ack 后用 ack 的 `messageId` 替换前端临时 id。

### B.2.2 临时 user message 状态机

```ts
type MessageStatus = 'pending' | 'sent' | 'streaming' | 'done' | 'error' | 'interrupted'
```

| 状态 | 含义 | 触发 |
|---|---|---|
| `pending` | 用户输入后立即插入 | Composer.submit |
| `sent` | 收到 `ack` 帧 | WS `{type:'ack'}` |
| `streaming` | 开始收 `message_start` | WS `{type:'message_start'}` |
| `done` | 收到 `message_stop` 且 `stop_reason === 'end_turn'` | WS `{type:'message_stop'}` |
| `error` | 收到 `error` 帧 | WS `{type:'error'}` |
| `interrupted` | 收到 `interrupted` 帧(用户主动取消) | WS `{type:'interrupted'}` |

---

## B.3 WS 协议(Portal 接收)

### B.3.1 握手(必须先校验)

```json
{ "type": "hello", "payload": { "protocolVersion": 1, "sessionId": "user-uuid" } }
```

收到 `hello` 后:
- 若 `protocolVersion !== PROTOCOL_VERSION`,close WebSocket 并显示"客户端/服务端版本不匹配,请刷新"
- 否则缓存版本,继续后续事件

### B.3.2 帧处理矩阵

| `type` | Portal 处理 |
|---|---|
| `hello` | 缓存 `protocolVersion`,确认协议兼容(否则 close) |
| `ack` | 把 `messageId` 对应的 user message 从 `pending` → `sent`,id 替换 |
| `message_start` | 创建新的 streaming assistant message,初始化空 content 数组 |
| `content_block_start` | 在 streaming message 上插入新 block(按 `content_block.type` 初始化) |
| `content_block_delta` | 增量追加到对应 block:`text_delta` → 文本,`thinking_delta` → thinking,`input_json_delta` → tool_use.input 字符串 |
| `content_block_stop` | 标记 block 完成(例如 thinking 块 finalize) |
| `message_delta` | 更新 streaming message 的 `stop_reason` 和 `usage` |
| `message_stop` | 标记 streaming message 为 `done`(若 `stop_reason === 'tool_use'` 则继续等下一轮) |
| `message` | 非流式时收到,完整替换当前 streaming message |
| `error` | 按 `code` 渲染对应 UI(详见 B.3.3) |
| `interrupted` | 标记 streaming message 为 `interrupted`,显示"已停止" |
| `ping` | 回 `{type: 'pong', payload: {ts: ...}}` |

### B.3.3 错误码 → UI 映射

| `code` | UI |
|---|---|
| `rate_limit` | "请求过快,${retry_after_ms/1000} 秒后重试" + 自动重试按钮(倒计时) |
| `auth` | "API 配置错误,请联系管理员"(红色 banner,不可重试) |
| `permission` | "无权限访问该模型"(红色 banner) |
| `not_found` | "模型不存在,请联系管理员" |
| `network` | "网络连接失败,正在重试…"(黄色 banner,自动重连) |
| `bad_request` | "请求参数错误: ${message}"(红色) |
| `refusal` | "此请求因安全策略被拒绝"(灰色,不重试) |
| `context_overflow` | "会话过长,请开启新会话"(蓝色提示) |
| `protocol_mismatch` | 客户端/服务端版本不匹配,引导刷新页面 |
| `unknown` | 通用错误,带 retry 按钮 |

---

## B.4 WS 客户端实现

### B.4.1 重写 `useAgentSocket`(替换 .js 为 .ts)

```ts
// src/lib/useAgentSocket.ts
import { useEffect, useRef } from 'react'

const URL = process.env.NEXT_PUBLIC_AGENT_WS_URL || 'ws://localhost:4102'
const BACKOFF_MS = [3000, 6000, 12000, 24000, 48000, 60000]
const PROTOCOL_VERSION = 1

export function useAgentSocket({
  onEvent,                              // (event: WsEvent) => void
  onConnectionChange,
}: {
  onEvent: (event: WsEvent) => void
  onConnectionChange: (state: 'connecting' | 'ok' | 'reconnecting' | 'failed') => void
}) {
  const wsRef = useRef<WebSocket | null>(null)
  const attemptRef = useRef(0)
  const closedByUserRef = useRef(false)
  const pendingRef = useRef<unknown[]>([])
  const authedRef = useRef(false)

  const connect = async () => {
    const res = await fetch('/api/agent-token', { credentials: 'include' })
    if (!res.ok) { onConnectionChange('failed'); return }
    const { token } = await res.json()

    const ws = new WebSocket(URL)               // ← 不放 URL!
    wsRef.current = ws
    authedRef.current = false

    ws.onopen = () => {
      // 第一帧必须发 auth
      ws.send(JSON.stringify({ type: 'auth', payload: { token } }))
    }

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        switch (data.type) {
          case 'hello':
            if (data.payload.protocolVersion !== PROTOCOL_VERSION) {
              ws.close(4000, 'protocol_mismatch')
              return
            }
            authedRef.current = true
            attemptRef.current = 0
            onConnectionChange('ok')
            while (pendingRef.current.length > 0) {
              ws.send(JSON.stringify(pendingRef.current.shift()))
            }
            break
          case 'pong':
            break
          default:
            onEvent(data as WsEvent)
        }
      } catch {}
    }

    ws.onclose = () => {
      if (closedByUserRef.current) return
      onConnectionChange('reconnecting')
      const idx = Math.min(attemptRef.current, BACKOFF_MS.length - 1)
      attemptRef.current += 1
      setTimeout(connect, BACKOFF_MS[idx])
    }

    ws.onerror = () => onConnectionChange('reconnecting')
  }

  useEffect(() => {
    connect()
    return () => {
      closedByUserRef.current = true
      wsRef.current?.close()
    }
  }, [])

  const send = (msg: unknown) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN && authedRef.current) {
      ws.send(JSON.stringify(msg))
    } else {
      pendingRef.current.push(msg)             // auth 通过后 flush
    }
  }

  return { send }
}
```

### B.4.2 类型定义(`src/lib/ws-types.ts`,新文件)

```ts
export type WsEvent =
  | { type: 'hello'; payload: { protocolVersion: number; sessionId: string } }
  | { type: 'ack'; payload: { messageId: string; ts: number } }
  | { type: 'message_start'; payload: { message: AnthropicMessage } }
  | { type: 'content_block_start'; payload: { index: number; content_block: ContentBlock } }
  | { type: 'content_block_delta'; payload: { index: number; delta: Delta } }
  | { type: 'content_block_stop'; payload: { index: number } }
  | { type: 'message_delta'; payload: { delta: { stop_reason: string | null; stop_sequence?: string }; usage?: Usage } }
  | { type: 'message_stop'; payload: Record<string, never> }
  | { type: 'message'; payload: AnthropicMessage }
  | { type: 'error'; payload: { code: string; http_status: number; message: string; category?: string; retry_after_ms?: number } }
  | { type: 'interrupted'; payload: { conversationId: string; reason: string } }
  | { type: 'ping'; payload: { ts: number } }

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown; inputRaw?: string }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

export type Delta =
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; thinking: string }
  | { type: 'input_json_delta'; partial_json: string }
  | { type: 'signature_delta'; signature: string }
```

### B.4.3 reducer:事件 → React state

`ChatShell` 维护 reducer 把 stream 事件累积成可渲染的 message:

```ts
type Message = {
  id: string
  role: 'user' | 'assistant'
  status: 'pending' | 'sent' | 'streaming' | 'done' | 'error' | 'interrupted'
  content: ContentBlock[]
  stop_reason?: string | null
  usage?: Usage
  clientMessageId?: string       // user 消息的临时 id,ack 后替换
}

function reduce(state: Message[], event: WsEvent): Message[] {
  switch (event.type) {
    case 'ack':
      return state.map(m =>
        m.clientMessageId === event.payload.messageId
          ? { ...m, id: event.payload.messageId, status: 'sent' }
          : m
      )

    case 'message_start':
      return [...state, {
        id: event.payload.message.id,
        role: 'assistant',
        status: 'streaming',
        content: [],
        stop_reason: null,
      }]

    case 'content_block_start':
      return state.map((m, i, arr) => {
        if (i !== arr.length - 1) return m
        return { ...m, content: [...m.content, event.payload.content_block] }
      })

    case 'content_block_delta': {
      return state.map((m, i, arr) => {
        if (i !== arr.length - 1) return m
        const content = [...m.content]
        const block: ContentBlock = { ...content[event.payload.index] } as any
        const delta = event.payload.delta
        if (delta.type === 'text_delta') {
          ;(block as any).text = ((block as any).text ?? '') + delta.text
        } else if (delta.type === 'thinking_delta') {
          ;(block as any).thinking = ((block as any).thinking ?? '') + delta.thinking
        } else if (delta.type === 'input_json_delta') {
          ;(block as any).inputRaw = ((block as any).inputRaw ?? '') + delta.partial_json
        }
        content[event.payload.index] = block
        return { ...m, content }
      })
    }

    case 'content_block_stop':
      // 可在此 finalize(parse input_json 等)
      return state

    case 'message_delta':
      return state.map((m, i, arr) => {
        if (i !== arr.length - 1) return m
        return {
          ...m,
          stop_reason: event.payload.delta.stop_reason ?? m.stop_reason,
          usage: event.payload.usage ?? m.usage,
        }
      })

    case 'message_stop':
      return state.map((m, i, arr) => {
        if (i !== arr.length - 1) return m
        return { ...m, status: 'done' }
      })

    case 'error':
      return state.map((m, i, arr) => {
        if (i === arr.length - 1 && m.status === 'streaming') {
          return {
            ...m,
            status: 'error',
            content: [...m.content, {
              type: 'text',
              text: `[${event.payload.code}] ${event.payload.message}`,
            } as ContentBlock],
          }
        }
        return m
      })

    case 'interrupted':
      return state.map((m, i, arr) => {
        if (i === arr.length - 1) return { ...m, status: 'interrupted' }
        return m
      })

    default:
      return state
  }
}
```

---

## B.5 组件改造

### B.5.1 `Composer.jsx`

- 改 `crypto.randomUUID()` 替代 `tmp-${Date.now()}`
- 去掉 1MB 阈值(改成走 `/api/chat/upload`)
- 去掉 base64 内联逻辑
- 加"停止"按钮(`onInterrupt` → 发 `user.interrupt`)
- 状态指示器:`pending` 显示省略号 / `sent` 单勾

### B.5.2 `MessageList.jsx` — 块级渲染

按 content block 类型分别渲染:

| Block 类型 | 渲染 |
|---|---|
| `text` | `<MarkdownView>`(打字机效果靠 streaming 增量自然出现) |
| `thinking` | 可折叠 `<details>`(默认折叠),灰色字体 |
| `tool_use` | 工具调用卡片(显示 name + 参数,可展开) |
| `tool_result` | 工具结果(可折叠) |

### B.5.3 `ChatShell.jsx` — 取消 / 重试 / 编辑

- **停止按钮**:有 streaming message 时显示,点击发 `user.interrupt`
- **assistant 重试按钮**:重新发上一条 user message(不带新 messageId,后端去重)
- **user 编辑按钮**:hover 显示,点击变 textarea,修改后发新消息(原消息标记为 deprecated)
- **状态显示**:`pending` 省略号 / `sent` 单勾 / `streaming` 闪烁光标 / `done` 双勾 / `error` 红叉

### B.5.4 错误 UI

按 B.3.3 表格实现:
- `rate_limit` 自动重试倒计时
- `network` 重连 banner
- `refusal` 灰底提示框(不可重试)
- `context_overflow` 提示开启新会话

---

## B.6 文件上传流程

```
用户拖文件
  → Composer.handleFile(file)
    → POST /api/chat/upload(走 Agent B.5.3)
      → Agent 走 Anthropic Files API
      → 返回 { file_id }
    → attachments: [{ type: 'file', file_id }]
  → 用户发送
    → WS { type: 'user.message', payload: { ..., attachments } }
```

无 1MB 阈值(Agent Files API 支持 500MB)。

---

## B.7 HTTP 代理(保留)

| Portal 路径 | Agent 路径 | 用途 |
|---|---|---|
| `GET /api/sessions` | `GET /api/conversations` | 列会话(sidebar) |
| `POST /api/sessions` | `POST /api/conversations` | 新建会话 |
| `PATCH /api/sessions/:id` | `PATCH /api/conversations/:id` | 重命名 |
| `DELETE /api/sessions/:id` | `DELETE /api/conversations/:id` | 删除 |
| `GET /api/sessions/:id/messages` | `GET /api/conversations/:id/messages` | 历史消息(返回 content block 数组) |

阶段 3 新增代理:
- `GET /api/chat/conversations/:id/events?after=<id>` → Agent `GET /api/chat/conversations/:id/events`

阶段 3:`/api/uploads.js` 改为代理到 Agent `/api/chat/upload`(或直接删除,前端改调 Agent)。

---

## B.8 鉴权(关键改动,阶段 3)

### B.8.1 删除双 secret 同步

删掉 `src/lib/agent-token.js` 和 `pages/api/agent-token.js` 里的 HS256 自签逻辑。

### B.8.2 新流程

```
浏览器 cookie (supabase session JWT)
  → Portal 直接用 cookie 调 /api/sessions/* HTTP(走 Agent 时透传 cookie)
  → Portal 用 cookie 调 /api/agent-token(从 Supabase session 取 access_token)
    → 返回 Supabase access_token(不是自签的)
  → 浏览器 WS 拿这个 token,WS 第一帧 auth
  → Agent 用 Supabase JWKS 验签
```

具体步骤:
1. Portal 增加 `/api/agent-token` endpoint,从 Supabase session 拿 access_token,直接返回(不重新签)
2. Portal `/api/sessions/*` 代理时不再签 token,直接转发 `Authorization: Bearer <supabase-jwt>` cookie(Supabase 已会携带)

### B.8.3 Cookie 处理

Supabase Auth 用 cookie 存 session,Supabase JS client 自动管理。Portal 直接用 SSR 的 `createServerClient` 或 `@supabase/ssr` 取 session,然后:
- HTTP 代理:透传 `Authorization: Bearer <access_token>` 给 Agent
- WS token:单独 endpoint 返回 access_token

### B.8.4 删除项

```diff
- src/lib/agent-token.js          # HS256 signAgentToken 删
- pages/api/agent-token.js        # 改成"取 Supabase access_token"
- SUPABASE_JWT_SECRET env 变量    # 不再需要
```

---

## B.9 消息体兼容

### B.9.1 历史消息响应(阶段 1 后)

`GET /api/sessions/:id/messages`:

```json
{
  "messages": [
    {
      "messageId": "msg_01ABC",
      "role": "assistant",
      "content": [
        { "type": "text", "text": "本月营收..." },
        { "type": "thinking", "thinking": "用户问的是..." }
      ],
      "status": "done",
      "stop_reason": "end_turn",
      "usage": { "input_tokens": 1234, "output_tokens": 567 },
      "createdAt": "2026-07-10T12:34:56Z"
    }
  ]
}
```

`content` 从字符串变为块数组,**前端 MessageList 必须按块渲染**。

### B.9.2 旧数据兼容

如果 DB 历史的 assistant message.content 是字符串(旧协议),前端渲染时自动包成 `[{type: 'text', text: <string>}]`。

---

## B.10 断线续传(阶段 3)

### B.10.1 重连后的历史拉取

```ts
// ChatShell 重连 onConnectionChange → 'ok'
async function onReconnect() {
  if (!activeId) return
  // 1. 拉历史事件(增量)
  const lastSeenId = localStorage.getItem(`lastEventId:${activeId}`)
  const r = await fetch(`/api/chat/conversations/${activeId}/events?after=${lastSeenId ?? ''}`)
  if (r.ok) {
    const { events } = await r.json()
    events.forEach((e: WsEvent) => reduceAndApply(e))
    if (events.length > 0) {
      localStorage.setItem(`lastEventId:${activeId}`, events[events.length - 1].id)
    }
  }
  // 2. 标记当前 streaming message 如果在重连期间完成,从历史恢复
  // 3. 重新订阅 WS(此时新的 user.message 会继续累积)
}
```

### B.10.2 event id 持久化

每收到一条 `message_start` / `content_block_start` 等业务事件,把它的 id 存 `localStorage`。前端可按 event id 精确去重。

---

## B.11 环境变量

```
# 现有(保留)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_AGENT_WS_URL=ws://agent:4102

# 新(WS 鉴权,阶段 3)
SUPABASE_SERVICE_ROLE_KEY=...       # 用于 portal 后端取 access_token
SUPABASE_JWKS_URL=...               # 给 portal 自己也用,验证 cookie session

# 删掉(阶段 3)
# SUPABASE_JWT_SECRET  # Portal 不再签 token
```

---

## B.12 不变量(Portal 端硬要求)

1. **永远不直接调 Anthropic SDK**(必须经 Agent)
2. **WS 第一帧是 `auth`**,第二帧开始才是 `user.message`
3. **不用 `Date.now()` 当 id**,统一用 `crypto.randomUUID()`
4. **content 必须按块渲染**,不准把整个 content 拼成字符串
5. **错误码必须区分**,按 B.3.3 表格渲染对应 UI
6. **`stop_reason === 'refusal'` 显示拒绝提示,不重试**
7. **`stop_reason === 'tool_use'` 不算结束**,继续等下一轮 message
8. **`stop_reason === 'max_tokens'` 提示用户可能截断**,提供"继续生成"按钮
9. **大附件走 `/api/chat/upload`**,不再 base64
10. **删除 `AGENT_JWT_SECRET` 相关代码**
11. **`stop_reason === 'context_window_exceeded'` 提示开启新会话**

---

## B.13 测试要求

### B.13.1 Portal 端

- **单元**:`useAgentSocket` reducer 各事件正确累积 content
- **单元**:`Composer` 走 `/api/chat/upload`,不再 base64
- **E2E**:打字机效果(每收一条 `content_block_delta` UI 增量)
- **E2E**:取消按钮发 `user.interrupt` → Agent 回 `interrupted`
- **E2E**:refusal 显示拒绝提示,不重试
- **E2E**:rate_limit 自动重试倒计时
- **E2E**:断线后重连,拉增量事件无重复

---

## 交叉引用

- 父计划:[../wdg-data-foundation/docs/chat-refactor-plan.md](../wdg-data-foundation/docs/chat-refactor-plan.md)
- 对侧 spec:[spec-chat-agent.md](../wdg-data-foundation/docs/spec-chat-agent.md)
- 对齐表 + 联调清单:[../wdg-data-foundation/docs/alignment-and-checklist.md](../wdg-data-foundation/docs/alignment-and-checklist.md)