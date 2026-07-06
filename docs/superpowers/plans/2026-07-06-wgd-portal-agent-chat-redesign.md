# WGD Portal → Agent Chat 重设计 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 WGD Portal 的「登录 → 应用门户」改成「登录 → /chat」。`/chat` 复刻 claude.ai 视觉,通过带签名 JWT 的 WebSocket 调用 agent。

**Architecture:** Portal(Next.js 14 Pages Router)+ agent(Fastify + ws)。Portal 用 supabase session 鉴权,签 10 分钟 HS256 JWT 给 agent WS 用;agent 在 connection 阶段验证 JWT,从 `sub` 取 userId。新增 Supabase 表 `chat_sessions` / `chat_messages`,第一版流式回复只在客户端 buffer,`task_done` 时落库。

**Tech Stack:** Next.js 14 (Pages Router) + Tailwind; `@supabase/supabase-js`; `jsonwebtoken`(agent); `react-markdown` + `remark-gfm` + `rehype-highlight`(chat UI)

**Spec:** `docs/superpowers/specs/2026-07-06-wgd-portal-agent-chat-redesign.md`

---

## 全局约束

复制自 spec:

- Portal dev 端口 3000, agent HTTP 4101, agent WS 4102
- 共享 secret: env 命名 `SUPABASE_JWT_SECRET`(portal 用)/ `AGENT_JWT_SECRET`(agent 用);**两份文件值相同**
- 前端 env: `NEXT_PUBLIC_AGENT_WS_URL=ws://localhost:4102`
- 输入字符上限 32000,超出截断
- WS 重连: 指数退避 3s/6s/12s/24s/48s/60s(封顶 60s)
- 视觉系统(chat 页): 背景 `#FBFAF7`,主文字 `#2D2A26`,次文字 `#6B6760`,边框 `#E8E4DC`,强调 `#C96442`,hover `#F0EDE5`
- 布局: ≥1024px 三栏(64 / 280 / flex),<1024px 两栏(64 / flex)
- 不引入 react-query / swr / redux / zustand — 仅用 React state + lib 工具函数
- 不要在 chat 页引入 GlassNav / GlowBackground 等老 glass / neon 组件;它们保留在 admin
- agent 端的 `IncomingMsg` / `OutgoingMsg` 类型不变,只换 userId 来源
- 不引入新的 agent 测试框架;沿用既有 `node --test`
- Portal 端测试用 vitest(第一版);不动 jest(项目没有)

---

## 文件结构(Locked)

### 新增(WGD_Portal)

| 文件 | 责任 |
| --- | --- |
| `supabase/migrations/2026-07-06-chat-tables.sql` | `chat_sessions` + `chat_messages` DDL + RLS |
| `middleware.js` | 拦截未登录访问 `/chat`/API,跳 `/login` |
| `lib/agent-token.js` | 服务端签 JWT(HS256, SUPABASE_JWT_SECRET) |
| `lib/useAgentSocket.js` | 客户端 hook:连接 / 重连 / token 刷新 / 事件分发 |
| `pages/api/sessions/index.js` | GET / POST `/api/sessions` |
| `pages/api/sessions/[id].js` | PATCH / DELETE `/api/sessions/:id` |
| `pages/api/sessions/[id]/messages.js` | GET `/api/sessions/:id/messages` |
| `pages/api/agent-token.js` | GET `/api/agent-token` |
| `pages/chat/index.jsx` | chat 主入口(用 ChatShell) |
| `components/chat/ChatShell.jsx` | 三栏布局 + 状态 |
| `components/chat/Sidebar.jsx` | 会话列表、新建、重命名、删除、应用入口 |
| `components/chat/MessageList.jsx` | 消息列表 + 自滚到底 |
| `components/chat/MarkdownView.jsx` | React-Markdown 包装 |
| `components/chat/Composer.jsx` | textarea + brand + 发送 |
| `components/chat/EmptyState.jsx` | 空消息时的欢迎语 + chip |
| `components/chat/BrandSelect.jsx` | brand 下拉(蜜可诗/旺鼎阁/泰柯茶园/无) |
| `vitest.config.js` | vitest 配置(单测环境) |
| `lib/agent-token.test.js` | 单测:sign/verify JWT |
| `lib/useAgentSocket.test.js` | 单测:hook 重连 / token 刷新 / 事件分发 |
| `pages/api/sessions/index.test.js` | API handler 单测(用 mocked supabase server client) |
| `pages/api/sessions/[id]/messages.test.js` | 跨用户 403 / 自己的能读 |

### 新增(agent)

| 文件 | 责任 |
| --- | --- |
| `src/channels/auth.ts` | `verifyAgentToken(token): { sub, exp }` / 抛错 |
| `src/channels/auth.test.ts` | 单元测试:合法 / 过期 / 伪造 / 缺失 |

### 改动(WGD_Portal)

| 文件 | 改动 |
| --- | --- |
| `pages/login.jsx` | 主题贴近 claude.ai 浅色;逻辑不变;成功后跳 `/chat` |
| `pages/index.jsx` | `getServerSideProps` redirect → `/chat` |
| `lib/auth.js` | 导出 `getCurrentUser(req)` helper(读 supabase session cookie) |
| `tailwind.config.js` | 加 chat 主题色:`paper` `#FBFAF7`, `ink` `#2D2A26`, `muted` `#6B6760`, `line` `#E8E4DC`, `claude` `#C96442`, `hover` `#F0EDE5` |
| `styles/globals.css` | 加 chat 主题基础样式(背景、字体、代码块) |
| `package.json` | + react-markdown, remark-gfm, rehype-highlight, vitest, @vitest/coverage-v8 |

### 改动(agent)

| 文件 | 改动 |
| --- | --- |
| `src/channels/web.ts` | connection 事件前置 JWT 校验,userId 从 `sub` 取 |
| `src/server.ts` | 在 web 之前加载 env(`dotenv`),不阻塞现有流程 |
| `package.json` | + jsonwebtoken, + @types/jsonwebtoken |
| `.env.example` | + `AGENT_JWT_SECRET=...` |

---

## 任务划分(Phase)

**Phase 1 — schema + agent 鉴权(没有这块,下游都做不了)**
- Task 1: Supabase migration(portal 仓库的 supabase 文件)
- Task 2: agent 装 jsonwebtoken + .env.example
- Task 3: agent `auth.ts` + 单测
- Task 4: agent 接入到 `web.ts`,userId 改为来自 `sub`(拆小步: 先写测试,再改 web.ts)

**Phase 2 — Portal 后端**
- Task 5: Portal 装依赖 + vitest 配置
- Task 6: Portal tailwind 主题色加 chat 调色板
- Task 7: Portal `lib/agent-token.js` + 单测
- Task 8: Portal `lib/auth.js` 扩 `getCurrentUser(req)`
- Task 9: Portal middleware.js 拦截未登录
- Task 10: Portal `/api/sessions` POST/GET
- Task 11: Portal `/api/sessions/[id]` PATCH/DELETE
- Task 12: Portal `/api/sessions/[id]/messages` GET
- Task 13: Portal `/api/agent-token` GET
- Task 14: Portal `pages/index.jsx` 改 redirect
- Task 15: Portal `pages/login.jsx` 主题重做

**Phase 3 — Portal 前端 chat**
- Task 16: `lib/useAgentSocket.js` + 单测
- Task 17: `components/chat/MarkdownView.jsx`(独立,先做这个,其它都要它)
- Task 18: `components/chat/Sidebar.jsx`
- Task 19: `components/chat/MessageList.jsx`
- Task 20: `components/chat/Composer.jsx` + `BrandSelect.jsx`
- Task 21: `components/chat/EmptyState.jsx`
- Task 22: `components/chat/ChatShell.jsx`(组装)
- Task 23: `pages/chat/index.jsx`

**Phase 4 — 端到端验证**
- Task 24: 手动 / 半自动 end-to-end:登录 → 进 chat → 建会话 → 发消息 → 流式 → 刷新看历史 → 改名 → 删

---

## Task 1: Supabase migration — chat_sessions / chat_messages

**Files:**
- Create: `supabase/migrations/2026-07-06-chat-tables.sql`(注意:仓库原 supabase 目录不存在,这里指 spec 提到的目录;若不存在由本任务创建)
- Test: 由运行此 SQL 后,在 dev SQL editor 里运行第 4 步的 sanity 校验

**Interfaces:**
- Consumes: supabase 项目 URL / service role
- Produces: `chat_sessions(id, user_id, brand, title, created_at, updated_at)`, `chat_messages(id, session_id, role, content, status, created_at)`,两表 RLS 启用

- [ ] **Step 1: 确认 supabase 目录是否存在**

```bash
ls /Users/ericmr/Documents/GitHub/WGD_Portal/supabase 2>/dev/null || echo "missing"
```

如果输出 missing,创建目录:

```bash
mkdir -p /Users/ericmr/Documents/GitHub/WGD_Portal/supabase/migrations
```

- [ ] **Step 2: 创建 migration 文件**

创建 `/Users/ericmr/Documents/GitHub/WGD_Portal/supabase/migrations/2026-07-06-chat-tables.sql`,内容如下:

```sql
-- chat sessions
create table chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  brand       text,
  title       text not null default '新会话',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index chat_sessions_user_idx on chat_sessions(user_id, updated_at desc);
alter table chat_sessions enable row level security;
create policy "user owns session" on chat_sessions
  for all using (auth.uid() = user_id);

-- chat messages
create table chat_messages (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references chat_sessions(id) on delete cascade,
  role          text not null check (role in ('user','assistant','system')),
  content       text not null,
  status        text,
  created_at    timestamptz not null default now()
);
create index chat_messages_session_idx on chat_messages(session_id, created_at);
alter table chat_messages enable row level security;
create policy "user owns messages" on chat_messages
  for all using (
    exists (select 1 from chat_sessions s
            where s.id = chat_messages.session_id
              and s.user_id = auth.uid())
  );
```

- [ ] **Step 3: 在 Supabase Dashboard → SQL Editor 执行此 SQL**

注意:此步骤不在代码仓库,需要用户在浏览器里跑一次。**Plan execute 时记录"已执行于 YYYY-MM-DD"**。

- [ ] **Step 4: 验证表已建立 + RLS 启用**

在 SQL Editor 跑:

```sql
select tablename, rowsecurity from pg_tables where tablename in ('chat_sessions','chat_messages');
select * from chat_sessions limit 0;        -- anon key 应报错
```

预期:两行 `rowsecurity=t`; anon key 查询报错 `permission denied`。

- [ ] **Step 5: 提交 migration 文件**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add supabase/migrations/2026-07-06-chat-tables.sql
git commit -m "feat(db): chat_sessions + chat_messages with RLS"
```

---

## Task 2: agent 装 jsonwebtoken + 加 env 示例

**Files:**
- Modify: `agent/package.json`(注意:agent 仓库在 `/Users/ericmr/Documents/GitHub/wdg-data-foundation/agent`,改动 cross-repo)
- Modify: `agent/.env.example`
- Modify: `agent/src/server.ts`(加 `dotenv/config`)

**注意:** 此任务以及 Task 3 / Task 4 在 agent 仓库。需要走 git worktree 或在两仓库之间切换。Plan execute 阶段建议给 agent 仓库开一个 worktree。

- [ ] **Step 1: 在 agent 仓库安装依赖**

```bash
cd /Users/ericmr/Documents/GitHub/wdg-data-foundation/agent
npm install jsonwebtoken
npm install -D @types/jsonwebtoken
```

- [ ] **Step 2: 检查 `dotenv` 是否已经在依赖里**

```bash
cd /Users/ericmr/Documents/GitHub/wdg-data-foundation/agent
grep -E '"(dotenv)"' package.json
```

如果没安装,装:

```bash
npm install dotenv
```

- [ ] **Step 3: 更新 `.env.example`**

追加一行:

```
AGENT_JWT_SECRET=replace-with-same-value-as-supabase-jwt-secret
```

- [ ] **Step 4: 在 `server.ts` 顶部加载 env**

在 `src/server.ts` 的最顶部(`import` 之前)加上:

```typescript
import 'dotenv/config'
```

注意:必须放在第一个 `import` 之前,以保证后续 getAgentConfig / verifyAgentToken 能取到 env。

- [ ] **Step 5: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/wdg-data-foundation/agent
git add package.json package-lock.json .env.example src/server.ts
git commit -m "chore(agent): add jsonwebtoken + dotenv + JWT secret env"
```

---

## Task 3: agent `auth.ts` + 单测

**Files:**
- Create: `agent/src/channels/auth.ts`
- Create: `agent/src/channels/auth.test.ts`

**Interfaces:**
- Exports: `verifyAgentToken(token: string): { sub: string, exp: number }`
- Throws: `Error` with message `'INVALID_TOKEN'` 或 `'EXPIRED_TOKEN'`
- Reads env: `process.env.AGENT_JWT_SECRET`

- [ ] **Step 1: 写测试(失败)**

创建 `agent/src/channels/auth.test.ts`:

```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { verifyAgentToken } from './auth.js'

const SECRET = 'test-secret-123'

// ensure env is set for the module under test
process.env.AGENT_JWT_SECRET = SECRET

test('verifyAgentToken accepts a valid token', () => {
  const token = jwt.sign({ sub: 'user-abc' }, SECRET, { expiresIn: '10m' })
  const out = verifyAgentToken(token)
  assert.equal(out.sub, 'user-abc')
  assert.ok(typeof out.exp === 'number')
})

test('verifyAgentToken rejects a forged token', () => {
  const token = jwt.sign({ sub: 'evil' }, 'wrong-secret', { expiresIn: '10m' })
  assert.throws(() => verifyAgentToken(token), /INVALID_TOKEN/)
})

test('verifyAgentToken rejects an expired token', () => {
  const token = jwt.sign({ sub: 'user-abc' }, SECRET, { expiresIn: '-1s' })
  assert.throws(() => verifyAgentToken(token), /EXPIRED_TOKEN/)
})

test('verifyAgentToken rejects empty string', () => {
  assert.throws(() => verifyAgentToken(''), /INVALID_TOKEN/)
})
```

- [ ] **Step 2: 运行测试,确认失败**

```bash
cd /Users/ericmr/Documents/GitHub/wdg-data-foundation/agent
npm test -- src/channels/auth.test.ts
```

预期:模块 `./auth.js` 不存在 → 失败。

- [ ] **Step 3: 创建 `auth.ts`**

创建 `agent/src/channels/auth.ts`:

```typescript
import jwt from 'jsonwebtoken'

export interface AgentClaims {
  sub: string
  exp: number
}

export function verifyAgentToken(token: string): AgentClaims {
  if (!token) {
    throw new Error('INVALID_TOKEN')
  }
  const secret = process.env.AGENT_JWT_SECRET
  if (!secret) {
    throw new Error('INVALID_TOKEN: AGENT_JWT_SECRET not configured')
  }
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as AgentClaims
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new Error('INVALID_TOKEN')
    }
    return { sub: payload.sub, exp: payload.exp }
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes('jwt expired')) {
      throw new Error('EXPIRED_TOKEN')
    }
    throw new Error('INVALID_TOKEN')
  }
}
```

- [ ] **Step 4: 跑测试,确认通过**

```bash
cd /Users/ericmr/Documents/GitHub/wdg-data-foundation/agent
npm test -- src/channels/auth.test.ts
```

预期:4 个 case 全 PASS。

- [ ] **Step 5: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/wdg-data-foundation/agent
git add src/channels/auth.ts src/channels/auth.test.ts
git commit -m "feat(agent): verifyAgentToken with HS256 JWT"
```

---

## Task 4: agent WebChannel 接入 JWT(关键鉴权闸口)

**Files:**
- Modify: `agent/src/channels/web.ts`
- Test: 临时手动校验脚本放到 `agent/src/channels/web.manual.test.ts`,由下一步创建

**Interfaces:**
- Consumes: `verifyAgentToken(token)`(从 auth.ts)
- 在 `connection` 事件里:
  - 提取 `token` query param,缺失 → `ws.close(1008, 'missing_token')`
  - 调 `verifyAgentToken`,失败 → `ws.close(1008, reason where reason ∈ {'invalid_token','expired_token'})`
  - `userId` 用 `claims.sub`,不再读 `url.searchParams.get('userId')`

- [ ] **Step 1: 改 `web.ts`(整段替换)**

将 `agent/src/channels/web.ts` 完整替换成:

```typescript
// agent/src/channels/web.ts
import { WebSocketServer, WebSocket } from 'ws'
import type { Channel, IncomingMsg, OutgoingMsg } from './types.js'
import type { ChannelManager } from './manager.js'
import { verifyAgentToken } from './auth.js'

interface Client {
  ws: WebSocket
  userId: string
  conversationId: string | null
}

export class WebChannel implements Channel {
  channelId = 'web' as const
  private wss: WebSocketServer
  private clients = new Map<WebSocket, Client>()

  constructor(
    private port: number,
    private manager: ChannelManager | null,
  ) {
    this.wss = new WebSocketServer({ port: this.port, host: '127.0.0.1' })
  }

  async start(): Promise<void> {
    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const token = url.searchParams.get('token')

      let userId: string
      try {
        if (!token) {
          ws.close(1008, 'missing_token')
          return
        }
        const claims = verifyAgentToken(token)
        userId = claims.sub
      } catch (e) {
        const reason = (e as Error).message.startsWith('EXPIRED_TOKEN')
          ? 'expired_token'
          : 'invalid_token'
        ws.close(1008, reason)
        return
      }

      this.clients.set(ws, { ws, userId, conversationId: null })

      ws.on('message', async (raw) => {
        try {
          const data = JSON.parse(raw.toString())
          const msg: IncomingMsg = {
            channelId: 'web',
            userId,
            brand: data.brand ?? null,
            conversationId: data.conversationId ?? null,
            content: data.content ?? '',
            attachments: data.attachments,
            metadata: data.metadata,
          }
          if (this.manager) {
            await this.manager.onIncoming(msg)
          }
        } catch (e) {
          ws.send(JSON.stringify({ type: 'system_error', payload: { code: 'BAD_INPUT', message: (e as Error).message } }))
        }
      })

      ws.on('close', () => { this.clients.delete(ws) })
      ws.on('error', () => { this.clients.delete(ws) })
    })
  }

  async send(msg: OutgoingMsg): Promise<void> {
    for (const [ws, client] of this.clients) {
      if (msg.conversationId && client.conversationId !== msg.conversationId) continue
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: msg.type, payload: msg.payload }))
      }
    }
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.wss.close(() => resolve()))
  }
}
```

- [ ] **Step 2: 写一个集成测试,用真实 ws 客户端连**

创建 `agent/src/channels/web.test.ts`:

```typescript
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import WebSocket from 'ws'
import { WebChannel } from './web.js'

const SECRET = 'integration-secret'
process.env.AGENT_JWT_SECRET = SECRET
const PORT = 4199

after(async () => {
  // sleep a bit so server closes cleanly
  await new Promise((r) => setTimeout(r, 100))
})

test('WebChannel rejects connection without token', async () => {
  const ch = new WebChannel(PORT, null)
  await ch.start()
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`)
  const closed = await new Promise<{ code: number, reason: string }>((resolve) => {
    ws.on('close', (code, reason) => resolve({ code, reason: reason.toString() }))
  })
  assert.equal(closed.code, 1008)
  assert.match(closed.reason, /missing_token/)
  await ch.stop()
})

test('WebChannel rejects expired token', async () => {
  const ch = new WebChannel(PORT + 1, null)
  await ch.start()
  const token = jwt.sign({ sub: 'u1' }, SECRET, { expiresIn: '-1s' })
  const ws = new WebSocket(`ws://127.0.0.1:${PORT + 1}?token=${token}`)
  const closed = await new Promise<{ code: number, reason: string }>((resolve) => {
    ws.on('close', (code, reason) => resolve({ code, reason: reason.toString() }))
  })
  assert.equal(closed.code, 1008)
  assert.match(closed.reason, /expired_token/)
  await ch.stop()
})
```

- [ ] **Step 3: 运行测试**

```bash
cd /Users/ericmr/Documents/GitHub/wdg-data-foundation/agent
npm test -- src/channels/web.test.ts
```

预期:两个 case 都 PASS。

- [ ] **Step 4: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/wdg-data-foundation/agent
git add src/channels/web.ts src/channels/web.test.ts
git commit -m "feat(agent): WebChannel JWT auth gate"
```

---

## Task 5: Portal 装依赖 + vitest

**Files:**
- Modify: `WGD_Portal/package.json`
- Create: `WGD_Portal/vitest.config.js`
- Create: `WGD_Portal/tests/setup.js`(可选)

- [ ] **Step 1: 安装生产依赖**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
npm install react-markdown remark-gfm rehype-highlight
```

- [ ] **Step 2: 安装开发依赖**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 3: 创建 `vitest.config.js`**

```javascript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['lib/**/*.test.js', 'pages/api/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/**/*.js', 'pages/api/**/*.js'],
    },
  },
})
```

- [ ] **Step 4: 在 `package.json` 加 test 脚本**

修改 `package.json`,`scripts` 段加:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 5: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add package.json package-lock.json vitest.config.js
git commit -m "chore(portal): add vitest + markdown deps"
```

---

## Task 6: Portal tailwind 主题色 + globals

**Files:**
- Modify: `WGD_Portal/tailwind.config.js`
- Modify: `WGD_Portal/styles/globals.css`

- [ ] **Step 1: 读现有 tailwind.config.js,保留老 token,新增**

打开 `tailwind.config.js`,在 `theme.extend.colors` 里追加(不要覆盖已有键):

```javascript
colors: {
  // 既有 neon-cyan / neon-purple / glass 保留
  paper: '#FBFAF7',
  ink: '#2D2A26',
  muted: '#6B6760',
  line: '#E8E4DC',
  claude: '#C96442',
  hover: '#F0EDE5',
},
```

- [ ] **Step 2: 读现有 globals.css,追加 chat 主题基础样式**

在文件末尾追加:

```css
@layer base {
  .chat-root {
    background-color: #FBFAF7;
    color: #2D2A26;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI",
      "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  }
  .chat-markdown pre {
    overflow-x: auto;
    background-color: #F0EDE5;
    border-radius: 8px;
    padding: 12px 16px;
    margin: 12px 0;
  }
  .chat-markdown code {
    background-color: #F0EDE5;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;
  }
  .chat-markdown pre code {
    background: transparent;
    padding: 0;
  }
  .chat-markdown table {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
  }
  .chat-markdown th, .chat-markdown td {
    border: 1px solid #E8E4DC;
    padding: 6px 10px;
    text-align: left;
  }
  .chat-markdown a { color: #C96442; text-decoration: underline; }
}
```

- [ ] **Step 3: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add tailwind.config.js styles/globals.css
git commit -m "feat(portal): chat theme tokens (paper / ink / muted / claude)"
```

---

## Task 7: Portal `lib/agent-token.js` + 单测

**Files:**
- Create: `WGD_Portal/lib/agent-token.js`
- Create: `WGD_Portal/lib/agent-token.test.js`

**Interfaces:**
- `signAgentToken(userId: string): { token: string, exp: number }` — 读 `process.env.SUPABASE_JWT_SECRET`
- `verifyAgentToken(token: string): { sub: string, exp: number }` — 用于 API 路由单元测试,本任务只测 sign

- [ ] **Step 1: 创建单测文件(失败)**

创建 `WGD_Portal/lib/agent-token.test.js`:

```javascript
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
    const { signAgentToken } = await import('./agent-token.js')
    expect(() => signAgentToken('user-x')).toThrow(/SUPABASE_JWT_SECRET/)
    process.env.SUPABASE_JWT_SECRET = original
  })
})
```

- [ ] **Step 2: 跑测试,确认失败**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
npm test -- lib/agent-token.test.js
```

预期:`./agent-token.js` 模块不存在 → 失败。

- [ ] **Step 3: 装 jsonwebtoken 到 portal**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
npm install jsonwebtoken
```

(已在 prod deps 里。)

- [ ] **Step 4: 实现 `lib/agent-token.js`**

```javascript
import jwt from 'jsonwebtoken'

const TOKEN_TTL_SECONDS = 600 // 10 min

export function signAgentToken(userId) {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET not configured')
  }
  if (!userId) {
    throw new Error('userId required')
  }
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  const token = jwt.sign({ sub: userId }, secret, {
    algorithm: 'HS256',
    expiresIn: TOKEN_TTL_SECONDS,
  })
  return { token, exp }
}
```

- [ ] **Step 5: 跑测试,确认通过**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
npm test -- lib/agent-token.test.js
```

预期:两个 case 都 PASS。

- [ ] **Step 6: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add lib/agent-token.js lib/agent-token.test.js package.json package-lock.json
git commit -m "feat(portal): signAgentToken (HS256, 10min)"
```

---

## Task 8: Portal `lib/auth.js` 扩 `getCurrentUser`

**Files:**
- Modify: `WGD_Portal/src/lib/auth.js`(portal 仓库的 lib 在 src/lib 下;注意路径 `src/lib/auth.js`)

**Interfaces:**
- Exports add: `getCurrentUser(req)` — 返回 `null` 或 `{ id, email }`
- Logic: 用 `@supabase/supabase-js` 的 server client(`createServerClient` 来自 `@supabase/ssr` 或 `@supabase/supabase-js` 的 `createClient` + Cookie adapter)。**最小做法:** 用现有 supabase client(`src/lib/supabase.js`)加 `req.headers.cookie`,手动解析 sb-access-token 字段。

- [ ] **Step 1: 读现有 auth.js 文件**

参考 `src/lib/auth.js` 已有内容,确认 supabase client 来自 `src/lib/supabase.js`。

- [ ] **Step 2: 在 `src/lib/auth.js` 末尾追加**

```javascript
import { supabase } from './supabase.js'

export async function getCurrentUser(req) {
  const cookieHeader = req.headers?.cookie || ''
  const match = cookieHeader.match(/sb-access-token=([^;]+)/)
  if (!match) return null
  const accessToken = decodeURIComponent(match[1])
  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error || !data?.user) return null
  return { id: data.user.id, email: data.user.email ?? null }
}
```

**注意:** 若仓库已有更优雅的 cookie 适配器(如 `@supabase/ssr`),沿用之;但只在改动最小的情况下。

- [ ] **Step 3: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add src/lib/auth.js
git commit -m "feat(auth): getCurrentUser from sb-access-token cookie"
```

---

## Task 9: Portal middleware 拦截未登录

**Files:**
- Create: `WGD_Portal/middleware.js`(仓库根,Next.js Pages Router 顶层)

- [ ] **Step 1: 创建 middleware**

```javascript
import { NextResponse } from 'next/server'

const PROTECTED = [/^\/chat/, /^\/api\/sessions/, /^\/api\/agent-token/]

export function middleware(req) {
  const { pathname } = req.nextUrl
  const needsAuth = PROTECTED.some((re) => re.test(pathname))
  if (!needsAuth) return NextResponse.next()

  const cookieHeader = req.headers.get('cookie') || ''
  const hasSession = /sb-access-token=/.test(cookieHeader)
  if (!hasSession) {
    if (pathname.startsWith('/api/')) {
      return new NextResponse(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/chat/:path*', '/api/sessions/:path*', '/api/agent-token'],
}
```

- [ ] **Step 2: 手动验证**

```bash
# 在另一个 shell,假设 server 已启动
curl -i -o /dev/null -w '%{http_code}\n' http://localhost:3000/chat
```

预期:302(redirect 到 /login),或 401(若带 /api/ 前缀)。

- [ ] **Step 3: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add middleware.js
git commit -m "feat(middleware): gate /chat and protected APIs"
```

---

## Task 10: Portal `/api/sessions` POST/GET

**Files:**
- Create: `WGD_Portal/pages/api/sessions/index.js`
- Create: `WGD_Portal/pages/api/sessions/index.test.js`

**Interfaces:**
- `GET /api/sessions` → `200 [{id, brand, title, updated_at}]`(倒序)
- `POST /api/sessions { brand? }` → `201 {id, brand, title, created_at}`

- [ ] **Step 1: 写测试 — 用 mocked supabase server client**

`pages/api/sessions/index.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock supabase server client
vi.mock('../../../src/lib/supabase.js', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}))

import { supabase } from '../../../src/lib/supabase.js'

const buildReq = (method, body = {}, cookie = 'sb-access-token=TOKEN') => ({
  method,
  body,
  headers: { cookie },
  query: {},
})

const buildRes = () => {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/sessions', () => {
  it('returns 401 when no session', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const handler = (await import('./index.js')).default
    const res = buildRes()
    await handler(buildReq('GET'), res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('returns 200 with user sessions', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    const orderMock = { data: [{ id: 's1', brand: null, title: 't', updated_at: '2026-07-06T00:00:00Z' }], error: null }
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({ order: () => Promise.resolve(orderMock) }),
      }),
    })
    const handler = (await import('./index.js')).default
    const res = buildRes()
    await handler(buildReq('GET'), res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith([{ id: 's1', brand: null, title: 't', updated_at: '2026-07-06T00:00:00Z' }])
  })
})

describe('POST /api/sessions', () => {
  it('creates a session and returns 201', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    const inserted = { id: 'snew', brand: '蜜可诗', title: '新会话', created_at: '2026-07-06T00:00:00Z' }
    supabase.from.mockReturnValue({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: inserted, error: null }),
        }),
      }),
    })
    const handler = (await import('./index.js')).default
    const res = buildRes()
    await handler(buildReq('POST', { brand: '蜜可诗' }), res)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(inserted)
  })
})
```

- [ ] **Step 2: 跑测试,确认失败**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
npm test -- pages/api/sessions/index.test.js
```

预期:`./index.js` 不存在 → 失败。

- [ ] **Step 3: 实现 `pages/api/sessions/index.js`**

```javascript
import { getCurrentUser } from '../../../src/lib/auth.js'
import { supabase } from '../../../src/lib/supabase.js'

export default async function handler(req, res) {
  const user = await getCurrentUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id,brand,title,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data ?? [])
  }

  if (req.method === 'POST') {
    const brand = typeof req.body?.brand === 'string' ? req.body.brand : null
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ user_id: user.id, brand })
      .select('id,brand,title,created_at')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  return res.status(405).json({ error: 'method_not_allowed' })
}
```

- [ ] **Step 4: 跑测试,确认通过**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
npm test -- pages/api/sessions/index.test.js
```

预期:3 个 case 全 PASS。

- [ ] **Step 5: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add pages/api/sessions/index.js pages/api/sessions/index.test.js
git commit -m "feat(api): GET/POST /api/sessions"
```

---

## Task 11: Portal `/api/sessions/[id]` PATCH/DELETE

**Files:**
- Create: `WGD_Portal/pages/api/sessions/[id].js`

**Interfaces:**
- `PATCH /api/sessions/[id] { title }` → 200;仅当 session 属于自己
- `DELETE /api/sessions/[id]` → 204
- 跨用户 → 403

- [ ] **Step 1: 创建文件**

```javascript
import { getCurrentUser } from '../../../src/lib/auth.js'
import { supabase } from '../../../src/lib/supabase.js'

async function ownSession(userId, id) {
  const { data } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  return Boolean(data)
}

export default async function handler(req, res) {
  const user = await getCurrentUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  const id = req.query.id
  if (!id) return res.status(400).json({ error: 'missing_id' })

  const owns = await ownSession(user.id, id)
  if (!owns) return res.status(403).json({ error: 'forbidden' })

  if (req.method === 'PATCH') {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : null
    if (!title) return res.status(400).json({ error: 'title_required' })
    const { data, error } = await supabase
      .from('chat_sessions')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id,title,updated_at')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('chat_sessions').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'method_not_allowed' })
}
```

- [ ] **Step 2: 手动验证 curl**

```bash
# 假设已 login,cookie 里 sb-access-token
curl -X PATCH -H "cookie: sb-access-token=<t>" -H 'content-type: application/json' \
  -d '{"title":"新名"}' http://localhost:3000/api/sessions/<id>
curl -X DELETE -H "cookie: sb-access-token=<t>" http://localhost:3000/api/sessions/<id>
```

预期:PATCH 200;DELETE 204;无 cookie → 401;别人的 id → 403。

- [ ] **Step 3: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add pages/api/sessions/[id].js
git commit -m "feat(api): PATCH/DELETE /api/sessions/[id]"
```

---

## Task 12: Portal `/api/sessions/[id]/messages` GET

**Files:**
- Create: `WGD_Portal/pages/api/sessions/[id]/messages.js`
- Create: `WGD_Portal/pages/api/sessions/[id]/messages.test.js`

- [ ] **Step 1: 写测试**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../../src/lib/supabase.js', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}))

import { supabase } from '../../../../src/lib/supabase.js'

const buildReq = (cookie = 'sb-access-token=TOKEN') => ({
  method: 'GET',
  headers: { cookie },
  query: { id: 's1' },
})
const buildRes = () => {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

beforeEach(() => vi.clearAllMocks())

describe('GET /api/sessions/[id]/messages', () => {
  it('returns 401 if unauth', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const handler = (await import('./messages.js')).default
    const res = buildRes()
    await handler(buildReq(), res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('returns 403 if session not owned', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
        }),
      }),
    })
    const handler = (await import('./messages.js')).default
    const res = buildRes()
    await handler(buildReq(), res)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('returns 200 with messages when session owned', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    // first call: ownSession check, returns row
    // second call: messages select
    const messages = [{ id: 'm1', role: 'user', content: 'hi', status: null, created_at: '2026-07-06T00:00:00Z' }]
    let call = 0
    supabase.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => call++ === 0
              ? Promise.resolve({ data: { id: 's1' }, error: null })
              : Promise.resolve({ data: null, error: null }),
          }),
          order: () => Promise.resolve({ data: messages, error: null }),
        }),
      }),
    }))
    const handler = (await import('./messages.js')).default
    const res = buildRes()
    await handler(buildReq(), res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(messages)
  })
})
```

- [ ] **Step 2: 跑测试,确认失败**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
npm test -- pages/api/sessions/\[id\]/messages.test.js
```

预期:`./messages.js` 不存在 → 失败。

- [ ] **Step 3: 实现**

```javascript
import { getCurrentUser } from '../../../../src/lib/auth.js'
import { supabase } from '../../../../src/lib/supabase.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

  const user = await getCurrentUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  const id = req.query.id
  if (!id) return res.status(400).json({ error: 'missing_id' })

  const { data: owned } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!owned) return res.status(403).json({ error: 'forbidden' })

  const { data, error } = await supabase
    .from('chat_messages')
    .select('id,role,content,status,created_at')
    .eq('session_id', id)
    .order('created_at', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json(data ?? [])
}
```

- [ ] **Step 4: 跑测试,确认通过**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
npm test -- pages/api/sessions/\[id\]/messages.test.js
```

预期:3 个 case 都 PASS。

- [ ] **Step 5: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add pages/api/sessions/\[id\]/messages.js pages/api/sessions/\[id\]/messages.test.js
git commit -m "feat(api): GET /api/sessions/[id]/messages"
```

---

## Task 13: Portal `/api/agent-token` GET

**Files:**
- Create: `WGD_Portal/pages/api/agent-token.js`

- [ ] **Step 1: 创建文件**

```javascript
import { getCurrentUser } from '../../src/lib/auth.js'
import { signAgentToken } from '../../lib/agent-token.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
  const user = await getCurrentUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  try {
    const { token, exp } = signAgentToken(user.id)
    return res.status(200).json({ token, exp })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
```

- [ ] **Step 2: 手动验证**

```bash
curl -H 'cookie: sb-access-token=<t>' http://localhost:3000/api/agent-token | jq
```

预期:`{ token, exp }`;无 cookie → 401。

- [ ] **Step 3: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add pages/api/agent-token.js
git commit -m "feat(api): GET /api/agent-token"
```

---

## Task 14: Portal `pages/index.jsx` redirect → /chat

**Files:**
- Modify: `WGD_Portal/src/pages/index.jsx`

- [ ] **Step 1: 整段替换**

```jsx
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function HomeRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/chat')
  }, [router])
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper text-muted text-sm">
      正在跳转到对话界面…
    </div>
  )
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/chat',
      permanent: false,
    },
  }
}
```

- [ ] **Step 2: 手动验证**

```bash
curl -i -o /dev/null -w '%{http_code}\n' http://localhost:3000/
```

预期:307 / 302,跳到 /chat(被 middleware 再跳 /login)→ 最终 307/302 到 /login。

- [ ] **Step 3: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add src/pages/index.jsx
git commit -m "feat(pages): / redirects to /chat"
```

---

## Task 15: Portal `login.jsx` 主题改造

**Files:**
- Modify: `WGD_Portal/src/pages/login.jsx`(整段替换,保留 onSubmit 逻辑)

- [ ] **Step 1: 整段替换**

```jsx
import { useState } from 'react'
import { useRouter } from 'next/router'
import { login } from '../lib/auth'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const session = await login(username, password)
      if (session) {
        const dest = typeof router.query.from === 'string' ? router.query.from : '/chat'
        router.push(dest)
      } else {
        setError('账号或密码错误')
      }
    } catch {
      setError('登录失败，请重试')
    }
    setLoading(false)
  }

  return (
    <div className="chat-root min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-paper border border-line rounded-2xl shadow-sm p-8 sm:p-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-ink">WGD Portal</h1>
          <p className="text-muted text-sm mt-1">公司应用门户</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm text-ink">账号</span>
            <input
              className="mt-1 w-full px-3 py-2 border border-line rounded-lg bg-paper text-ink
                         focus:outline-none focus:border-claude focus:ring-1 focus:ring-claude"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入账号"
            />
          </label>
          <label className="block">
            <span className="text-sm text-ink">密码</span>
            <input
              type="password"
              className="mt-1 w-full px-3 py-2 border border-line rounded-lg bg-paper text-ink
                         focus:outline-none focus:border-claude focus:ring-1 focus:ring-claude"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
            />
          </label>

          {error && <p className="text-claude text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-ink text-paper hover:opacity-90 transition
                       disabled:opacity-50"
          >
            {loading ? '登录中…' : '登 录'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 手动验证**

启动 dev,访问 `/login`,看视觉是否贴近 claude.ai 浅色框。

- [ ] **Step 3: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add src/pages/login.jsx
git commit -m "style(login): claude.ai light theme"
```

---

## Task 16: Portal `useAgentSocket` + 单测

**Files:**
- Create: `WGD_Portal/src/lib/useAgentSocket.js`
- Create: `WGD_Portal/src/lib/useAgentSocket.test.js`

**Interfaces:**
- `useAgentSocket({ onUpdate, onDone, onError, onConnectionChange })`
  - 组件挂载后 fetch `/api/agent-token`,得 `{token, exp}`
  - new WebSocket(`NEXT_PUBLIC_AGENT_WS_URL + ?token=...`)
  - 监听 message → JSON parse → 按 `type` 分发
  - onclose: 退避 3s / 6s / 12s / 24s / 48s / 60s;重连前重新拉 token
  - onopen: onConnectionChange('ok')
  - onerror/onclose: onConnectionChange('reconnecting' | 'failed')
- 输入字符上限 32000,超过截断 + onError({code:'oversize'})

- [ ] **Step 1: 写测试**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock global WebSocket
class FakeWS {
  constructor(url) {
    this.url = url
    FakeWS.instances.push(this)
    this.readyState = 0 // CONNECTING
    this.listeners = {}
  }
  send() {}
  close() { this.readyState = 3 }
  addEventListener() {} // not used; we use on-open assignment
}

global.WebSocket = FakeWS

// mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ token: 'T', exp: 9999 }) })
)

beforeEach(() => {
  FakeWS.instances = []
  vi.clearAllMocks()
})

describe('useAgentSocket', () => {
  it('fetches token and opens WS with it', async () => {
    const { renderHook, act, waitFor } = await import('@testing-library/react')
    const { default: useAgentSocket } = await import('./useAgentSocket.js')
    renderHook(() => useAgentSocket({ onUpdate: () => {}, onDone: () => {}, onError: () => {}, onConnectionChange: () => {} }))
    await waitFor(() => expect(FakeWS.instances.length).toBe(1))
    const ws = FakeWS.instances[0]
    expect(ws.url).toMatch(/\?token=T/)
  })

  it('dispatches task_update and task_done', async () => {
    const { renderHook, waitFor } = await import('@testing-library/react')
    const onUpdate = vi.fn()
    const onDone = vi.fn()
    const { default: useAgentSocket } = await import('./useAgentSocket.js')
    renderHook(() => useAgentSocket({ onUpdate, onDone, onError: () => {}, onConnectionChange: () => {} }))
    await waitFor(() => expect(FakeWS.instances.length).toBe(1))
    const ws = FakeWS.instances[0]
    ws.listeners.message?.({ data: JSON.stringify({ type: 'task_update', payload: { delta: 'hi' } }) })
    ws.listeners.message?.({ data: JSON.stringify({ type: 'task_done', payload: { content: 'done' } }) })
    expect(onUpdate).toHaveBeenCalledWith({ delta: 'hi' })
    expect(onDone).toHaveBeenCalledWith({ content: 'done' })
  })
})
```

- [ ] **Step 2: 装 @testing-library/react**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
npm install -D @testing-library/react jsdom
```

并在 `vitest.config.js` 加 `environment: 'jsdom'`,以及 `test.environmentMatchGlobs` 或 `...` 配置 jsdom 用 lib test:

```javascript
// 在 vitest.config.js 添加
test: {
  environmentMatchGlobs: [
    ['src/lib/**/*.test.js', 'jsdom'],
  ],
},
```

- [ ] **Step 3: 实现 `src/lib/useAgentSocket.js`**

```javascript
import { useEffect, useRef } from 'react'

const MAX_INPUT = 32000
const URL = process.env.NEXT_PUBLIC_AGENT_WS_URL || 'ws://localhost:4102'
const BACKOFF_MS = [3000, 6000, 12000, 24000, 48000, 60000]

export function clampInput(text) {
  if (text.length > MAX_INPUT) return { text: text.slice(0, MAX_INPUT), oversize: true }
  return { text, oversize: false }
}

export function defaultUseAgentSocket({
  onUpdate = () => {},
  onDone = () => {},
  onError = () => {},
  onConnectionChange = () => {},
} = {}) {
  const wsRef = useRef(null)
  const attemptRef = useRef(0)
  const closedByUserRef = useRef(false)

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
        setTimeout(() => { attemptRef.current += 1; connect() }, BACKOFF_MS[idx])
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
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }
  return { send }
}

export default defaultUseAgentSocket
```

- [ ] **Step 4: 跑测试,确认通过**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
npm test -- src/lib/useAgentSocket.test.js
```

预期:2 个 case 都 PASS。

- [ ] **Step 5: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add src/lib/useAgentSocket.js src/lib/useAgentSocket.test.js vitest.config.js package.json package-lock.json
git commit -m "feat(chat): useAgentSocket hook + clampInput"
```

---

## Task 17: `MarkdownView.jsx`

**Files:**
- Create: `WGD_Portal/src/components/chat/MarkdownView.jsx`

- [ ] **Step 1: 实现**

```jsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

export default function MarkdownView({ children }) {
  return (
    <div className="chat-markdown text-ink leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
```

- [ ] **Step 2: 手动验证**

任意 chat 页面引用并传入含 ```code``` 的字符串,确认高亮。

- [ ] **Step 3: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add src/components/chat/MarkdownView.jsx
git commit -m "feat(chat): MarkdownView with gfm + highlight"
```

---

## Task 18: `Sidebar.jsx`

**Files:**
- Create: `WGD_Portal/src/components/chat/Sidebar.jsx`

**Props:**
- `sessions: Array<{id, title, brand}>`
- `activeId: string | null`
- `onSelect(id)`, `onCreate()`, `onRename(id, title)`, `onDelete(id)`
- `isAdmin: boolean`

- [ ] **Step 1: 实现**

```jsx
import { useState } from 'react'

export default function Sidebar({ sessions, activeId, onSelect, onCreate, onRename, onDelete, isAdmin, onOpenAdmin }) {
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const commitRename = (id) => {
    const t = draft.trim()
    if (t) onRename(id, t)
    setEditingId(null)
    setDraft('')
  }

  return (
    <aside className="w-[280px] h-screen bg-paper border-r border-line flex flex-col">
      <div className="p-3">
        <button
          onClick={onCreate}
          className="w-full text-left px-3 py-2 rounded-lg border border-line bg-paper hover:bg-hover text-ink text-sm"
        >
          + 新建
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 space-y-1">
        {sessions.length === 0 ? (
          <p className="text-muted text-sm px-3 py-6">还没有会话</p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className={`group relative rounded-lg px-3 py-2 cursor-pointer text-sm
                          ${s.id === activeId ? 'bg-hover text-ink' : 'text-ink hover:bg-hover'}`}
              onClick={() => editingId === s.id ? null : onSelect(s.id)}
            >
              {editingId === s.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(s.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="w-full bg-paper text-ink text-sm focus:outline-none"
                />
              ) : (
                <>
                  <div className="truncate">{s.title}</div>
                  {s.brand && <div className="text-muted text-xs mt-0.5">{s.brand}</div>}
                  <div className="hidden group-hover:flex absolute right-2 top-2 gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(s.id); setDraft(s.title) }}
                      className="text-muted hover:text-ink text-xs"
                      title="重命名"
                    >✎</button>
                    {confirmDeleteId === s.id ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(s.id); setConfirmDeleteId(null) }}
                        className="text-claude text-xs"
                      >确认删除</button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(s.id) }}
                        className="text-muted hover:text-claude text-xs"
                        title="删除"
                      >🗑</button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </nav>

      <div className="p-3 border-t border-line space-y-2">
        {isAdmin && (
          <button onClick={onOpenAdmin} className="block w-full text-left text-sm text-muted hover:text-ink">
            管理后台 →
          </button>
        )}
        <p className="text-xs text-muted">WGD Portal</p>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: 手动验证**

`/chat` 入口接 3 个会话,看视觉、新建、重命名、删除 hover 行为。

- [ ] **Step 3: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add src/components/chat/Sidebar.jsx
git commit -m "feat(chat): Sidebar with rename/delete/new"
```

---

## Task 19: `MessageList.jsx`

**Files:**
- Create: `WGD_Portal/src/components/chat/MessageList.jsx`

**Props:** `messages: Array<{id?, role, content}>`, `streamingBuffer: string`, `failed: boolean`

- [ ] **Step 1: 实现**

```jsx
import { useEffect, useRef } from 'react'
import MarkdownView from './MarkdownView'

export default function MessageList({ messages, streamingBuffer, failed }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, streamingBuffer])

  return (
    <div ref={ref} className="flex-1 overflow-y-auto px-6 py-8 bg-paper">
      <div className="max-w-[720px] mx-auto space-y-6">
        {messages.map((m, i) => {
          const isUser = m.role === 'user'
          const isLastAssistant = !isUser && i === messages.length - 1
          return (
            <div key={m.id ?? i} className={isUser ? 'flex justify-end' : 'flex justify-start'}>
              <div className={
                isUser
                  ? 'bg-ink text-paper rounded-2xl px-4 py-2.5 max-w-[80%]'
                  : 'text-ink max-w-[100%]'
              }>
                {isUser ? (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                ) : (
                  <>
                    <MarkdownView>{m.content}</MarkdownView>
                    {isLastAssistant && streamingBuffer && (
                      <span className="ml-1 inline-block animate-pulse text-claude">▍</span>
                    )}
                    {failed && isLastAssistant && (
                      <p className="mt-2 text-xs text-claude">⚠ 回复中断</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
        {streamingBuffer && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="text-ink max-w-[100%]">
              <MarkdownView>{streamingBuffer}</MarkdownView>
              <span className="ml-1 inline-block animate-pulse text-claude">▍</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 手动验证**

非空 chat 列表 + 流式回显确认光标、自动滚到底。

- [ ] **Step 3: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add src/components/chat/MessageList.jsx
git commit -m "feat(chat): MessageList with auto-scroll + streaming caret"
```

---

## Task 20: `Composer.jsx` + `BrandSelect.jsx`

**Files:**
- Create: `WGD_Portal/src/components/chat/Composer.jsx`
- Create: `WGD_Portal/src/components/chat/BrandSelect.jsx`

- [ ] **Step 1: BrandSelect**

```jsx
const OPTIONS = [
  { value: '', label: '不限品牌' },
  { value: '蜜可诗', label: '蜜可诗' },
  { value: '旺鼎阁', label: '旺鼎阁' },
  { value: '泰柯茶园', label: '泰柯茶园' },
]

export default function BrandSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm bg-paper border border-line rounded-md px-2 py-1 text-ink focus:outline-none focus:border-claude"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
```

- [ ] **Step 2: Composer**

```jsx
import { useState } from 'react'
import BrandSelect from './BrandSelect'
import { clampInput } from '../../lib/useAgentSocket'

export default function Composer({ onSend, disabled }) {
  const [text, setText] = useState('')
  const [brand, setBrand] = useState('')
  const [oversize, setOversize] = useState(false)

  const submit = () => {
    const { text: t, oversize: o } = clampInput(text)
    if (!t.trim()) return
    setOversize(o)
    onSend({ content: t, brand: brand || null })
    setText('')
  }

  return (
    <div className="border-t border-line bg-paper px-6 py-4">
      <div className="max-w-[720px] mx-auto">
        {oversize && (
          <p className="text-claude text-xs mb-2">内容超过 32000 字符,已截断</p>
        )}
        <div className="flex items-end gap-2 border border-line rounded-2xl px-3 py-2 bg-paper">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="聊点什么…"
            rows={1}
            className="flex-1 resize-none bg-paper text-ink placeholder:text-muted focus:outline-none text-sm"
            style={{ minHeight: 36, maxHeight: 200 }}
          />
          <BrandSelect value={brand} onChange={setBrand} />
          <button
            onClick={submit}
            disabled={disabled || !text.trim()}
            className="px-4 py-1.5 rounded-lg bg-ink text-paper text-sm
                       disabled:opacity-40 hover:opacity-90 transition"
          >发送</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 手动验证**

发送按钮在空文本时 disabled;enter 提交;shift+enter 换行;brand 切换填入 onSend。

- [ ] **Step 4: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add src/components/chat/Composer.jsx src/components/chat/BrandSelect.jsx
git commit -m "feat(chat): Composer + BrandSelect with oversize guard"
```

---

## Task 21: `EmptyState.jsx`

**Files:**
- Create: `WGD_Portal/src/components/chat/EmptyState.jsx`

- [ ] **Step 1: 实现**

```jsx
const CHIPS = [
  '上月蜜可诗 GMV 多少?',
  '现在账户余额多少?',
  '本周异常交易?',
]

export default function EmptyState({ onPick }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 bg-paper">
      <div className="max-w-[720px] w-full text-center">
        <h2 className="text-xl font-semibold text-ink mb-2">问吧</h2>
        <p className="text-muted text-sm mb-6">关于蜜可诗 / 旺鼎阁 / 泰柯茶园的数据,都能聊</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => onPick(c)}
              className="text-sm px-3 py-1.5 rounded-full border border-line text-ink hover:bg-hover"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 手动验证**

进 chat、新建会话、消息为空 → 应看到 chip;点 chip 把文字送进 composer。

- [ ] **Step 3: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add src/components/chat/EmptyState.jsx
git commit -m "feat(chat): EmptyState with suggestion chips"
```

---

## Task 22: `ChatShell.jsx`

**Files:**
- Create: `WGD_Portal/src/components/chat/ChatShell.jsx`

**责任:**
- 拉 `/api/sessions`(activeId 默认最新或 null)
- 切 active 时拉 `/api/sessions/:id/messages`
- 调用 `useAgentSocket` 接事件 → 更新 `streamingBuffer` / 提交 assistant message / 失败标记
- 提供 `onSend` 给 Composer:本地 push user message → POST 不写消息到 server(让 agent stream 时写)→ socket.send

**特殊:** 第一版**不**在用户发送时写 chat_messages;改由 agent 端在收到 `IncomingMsg` 后写入 user message,`task_done` 后写 assistant message。本任务不修改 agent,只在 client 端把 user message 暂存为临时 ID。

- [ ] **Step 1: 实现**

```jsx
import { useEffect, useState, useCallback } from 'react'
import Sidebar from './Sidebar'
import MessageList from './MessageList'
import Composer from './Composer'
import EmptyState from './EmptyState'
import useAgentSocket from '../../lib/useAgentSocket'

let tempId = 0
const nextTempId = () => `t-${++tempId}`

export default function ChatShell({ currentUser, isAdmin }) {
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [streamingBuffer, setStreamingBuffer] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [failed, setFailed] = useState(false)
  const [connState, setConnState] = useState('connecting')

  // load sessions
  useEffect(() => {
    fetch('/api/sessions', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const arr = Array.isArray(d) ? d : []
        setSessions(arr)
        if (arr[0]) setActiveId(arr[0].id)
      })
      .catch(() => {})
  }, [])

  // load messages when active changes
  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    fetch(`/api/sessions/${activeId}/messages`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setMessages(Array.isArray(d) ? d : []))
      .catch(() => setMessages([]))
  }, [activeId])

  // socket
  const { send } = useAgentSocket({
    onUpdate: (p) => setStreamingBuffer((b) => b + (p?.delta ?? '')),
    onDone: (p) => {
      const final = streamingBuffer + (p?.content ?? '')
      setStreamingBuffer('')
      setStreaming(false)
      setMessages((m) => [...m, { role: 'assistant', content: final, status: 'done' }])
    },
    onError: () => {
      setStreaming(false)
      setFailed(true)
    },
    onConnectionChange: setConnState,
  })

  const onSend = ({ content, brand }) => {
    if (!activeId) {
      // 没有 session:自动创建一个
      fetch('/api/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ brand }),
      })
        .then((r) => r.json())
        .then((s) => {
          setSessions((arr) => [s, ...arr])
          setActiveId(s.id)
          // 当前还没有 activeId,发送排队到下个 effect 里
          pendingRef.current = { content, brand }
        })
      return
    }
    setMessages((m) => [...m, { id: nextTempId(), role: 'user', content }])
    setStreaming(true)
    setFailed(false)
    setStreamingBuffer('')
    send({ conversationId: activeId, content, brand })
  }

  // 处理「没有 activeId 时新建后才发送」的延迟
  const pendingRef = useRef(null)
  useEffect(() => {
    if (activeId && pendingRef.current) {
      const { content, brand } = pendingRef.current
      pendingRef.current = null
      setMessages((m) => [...m, { id: nextTempId(), role: 'user', content }])
      setStreaming(true)
      setStreamingBuffer('')
      send({ conversationId: activeId, content, brand })
    }
  }, [activeId])

  // sidebar ops
  const onCreate = () =>
    fetch('/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((s) => { setSessions((arr) => [s, ...arr]); setActiveId(s.id) })

  const onRename = (id, title) =>
    fetch(`/api/sessions/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    }).then(() => setSessions((arr) => arr.map((s) => s.id === id ? { ...s, title } : s)))

  const onDelete = (id) =>
    fetch(`/api/sessions/${id}`, { method: 'DELETE', credentials: 'include' })
      .then(() => {
        setSessions((arr) => arr.filter((s) => s.id !== id))
        if (activeId === id) {
          const next = sessions.find((s) => s.id !== id)
          setActiveId(next?.id ?? null)
        }
      })

  return (
    <div className="chat-root min-h-screen flex">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={onCreate}
        onRename={onRename}
        onDelete={onDelete}
        isAdmin={isAdmin}
      />
      <div className="flex-1 flex flex-col">
        <header className="border-b border-line px-6 py-3 text-sm text-muted bg-paper">
          {connState === 'ok' ? '已连接' :
           connState === 'reconnecting' ? '重连中…' :
           connState === 'failed' ? '连接失败' : '连接中…'}
        </header>
        {messages.length === 0 && !streaming
          ? <EmptyState onPick={(c) => onSend({ content: c, brand: null })} />
          : <MessageList messages={messages} streamingBuffer={streamingBuffer} failed={failed} />
        }
        <Composer onSend={onSend} disabled={streaming} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 手动验证**

进入 /chat 看三栏、切消息、自动滚到底。

- [ ] **Step 3: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add src/components/chat/ChatShell.jsx
git commit -m "feat(chat): ChatShell ties it all together"
```

---

## Task 23: `pages/chat/index.jsx`

**Files:**
- Create: `WGD_Portal/src/pages/chat/index.jsx`

- [ ] **Step 1: 实现**

```jsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getCurrentUser } from '../lib/auth'   // 需要在 page 层做 client 化
import ChatShell from '../components/chat/ChatShell'

export default function ChatPage() {
  const [user, setUser] = useState(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/agent-token', { credentials: 'include' })
      .then((r) => {
        if (r.status === 401) { router.replace('/login'); return null }
        return r.json()
      })
      .then((d) => {
        if (!d) return
        // token 拿到说明 server-side 已经验证过 session
        // 这里仍需要 user.id 来做 isAdmin 判断;实际生产由后端给一个 /api/me 接口
        // 第一版简化为:任何登录用户都视为普通用户,isAdmin 通过显式 email 列表判断
        const fromToken = parseJwtSub(d.token)
        setUser({ id: fromToken, email: null })
      })
      .catch(() => router.replace('/login'))
  }, [router])

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center text-muted text-sm">加载中…</div>
  }
  const isAdmin = typeof window !== 'undefined' && window.__IS_ADMIN__ === true
  return <ChatShell currentUser={user} isAdmin={isAdmin} />
}

function parseJwtSub(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.sub
  } catch {
    return null
  }
}
```

**关于 isAdmin:** 此处简化实现,把判定推到 `pages/chat/index.jsx` 之外的中间层更干净;但 spec 不要求 admin gate,**本任务按本实现**。如果实施时发现需要 admin 入口,后续 task 加 `/api/me` 解决。

- [ ] **Step 2: 手动验证**

启动 dev,登录后访问 /chat,看到三栏 + 空状态;agent 没启动时顶栏显示「连接中…」。

- [ ] **Step 3: 提交**

```bash
cd /Users/ericmr/Documents/GitHub/WGD_Portal
git add src/pages/chat/index.jsx
git commit -m "feat(pages): /chat entry"
```

---

## Task 24: 端到端验证

**Files:**
- 不写新代码,做 verification

**步骤:**

- [ ] **Step 1: 启动两个 dev server**

```bash
# Shell 1
cd /Users/ericmr/Documents/GitHub/wdg-data-foundation/agent
AGENT_JWT_SECRET=<same-as-portal> npm run dev

# Shell 2
cd /Users/ericmr/Documents/GitHub/WGD_Portal
npm run dev
```

预期:两个 server 都 ready。Portal 在 3000、agent HTTP 4101、agent WS 4102。

- [ ] **Step 2: 端到端 happy path**

1. 浏览器访问 `http://localhost:3000/login`,登录一个 supabase 已有账号
2. 自动跳到 `/chat`,看到三栏 + empty state
3. 点「+ 新建」,新建会话
4. 在 composer 输入「上月蜜可诗 GMV 多少?」,点发送
5. 看到 user 气泡出现,然后 assistant 流式回显
6. 等 task_done 后,刷新页面,历史消息完整保留
7. 在 sidebar hover 该会话,改名为「蜜可诗月报」
8. hover 垃圾桶 → 「确认删除」

- [ ] **Step 3: 错误路径**

1. 停掉 agent(`Ctrl-C`)
2. 在 chat 里发消息 → 应看到顶部「连接中…/重连中…」 + composer 仍可输入但 reply 不会到
3. 重新启动 agent → 顶栏回到「已连接」

- [ ] **Step 4: RLS 校验**

在 Supabase SQL Editor 用另一 user 的 token:

```sql
set request.jwt.claim.sub = '<other-user-id>';
select * from chat_sessions;  -- 应 0 行
```

- [ ] **Step 5: 提交 verify 报告**

不需要 git 提交。验证结果以对话形式报告给用户。

---

## Self-Review(对照 spec)

| Spec 段 | 实现 task |
| --- | --- |
| § 1.1 路由表 | Task 9 (middleware) + Task 14 (index) + Task 15 (login) + Task 23 (chat page) |
| § 1.2 API 路由 | Task 10 / 11 / 12 / 13 |
| § 1.3 数据流 | Task 16 + 22 |
| § 2.1 chat_sessions | Task 1 |
| § 2.2 chat_messages | Task 1 |
| § 3 JWT 设计 | Task 3 / 4 / 7 |
| § 4 视觉 / 主题 | Task 6 + 17 / 18 / 19 / 20 / 21 / 22 |
| § 5 错误处理 | Task 4 (close codes) + 22 (failed 态) + 20 (oversize) + 16 (重连) |
| § 6.1 单元 | Task 3 / 7 / 16 |
| § 6.2 集成 | Task 4 + 10 / 11 / 12 / 13 |
| § 6.3 end-to-end | Task 24 |
| § 6.4 UI 视觉 | Task 6 + 18-22 |
| § 6.5 RLS | Task 1 + Task 24 step 4 |
| § 9 依赖变更 | Task 2 / 5 |
| § 10 文件清单 | 全部已覆盖 |

**发现的小调整已 inline 修复:**
- `index.test.js` 里 `tokens.order` 拼写(应为 `tokens` / `select().order()`),已修正为先有的 `select().eq().order()` 链路,与 supabase-js v2 匹配。
- Task 20 oversize 状态交互:每条 `onSend` 都重新计算 `oversize`,与全局约束一致。
- Task 16 测试用 `@testing-library/react`,已在 step 2 安装并配 vitest jsdom 环境。

**未在 plan 里做的事(spec § 8 后续):**
- 多 agent 切换 — 跳过
- 文件上传 — 跳过
- 重新生成(retry) — 跳过(只 user message 级别重发)
- streaming buffer 持久化 — 跳过
- isAdmin 真正的 server-side 实现 — 当前用占位,后续加 `/api/me`(spec 范围外)

**Plan 备查:** 路径 `docs/superpowers/plans/2026-07-06-wgd-portal-agent-chat-redesign.md`
