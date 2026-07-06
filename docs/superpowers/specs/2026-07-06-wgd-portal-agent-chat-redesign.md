# WGD Portal → Agent Chat 重设计

日期: 2026-07-06
状态: 设计稿(待 spec review)
关联仓库:
- `/Users/ericmr/Documents/GitHub/WGD_Portal` — Next.js 14 门户
- `/Users/ericmr/Documents/GitHub/wdg-data-foundation/agent` — Fastify + WS agent

## 目标

把 WGD Portal 的「登录 → 应用门户」流程,改成「登录 → /chat」。`/chat` 是一个完整复刻 claude.ai 视觉的对话界面,后端 agent 通过签名 token 的 WebSocket 接收用户消息并流式返回结果。原来 admin 后台和应用入口保留但调整位置(并入 sidebar)。不做的事:不动 agent 的推理核心、不重构 portal 老页面、不动 admin 后台。

## 范围之外

- agent 的 tools / skills / cron / MCP bridge: 完全不动
- 老的 `pages/index.jsx` 应用门户: 删除,改为 redirect 到 `/chat`
- 老 login 视觉: 改成贴近 claude.ai 浅色主题
- admin 后台视觉改造: 不在本 spec,保留老 glass/neon 即可

---

## 1. 整体架构

### 1.1 路由表

| 路径 | 文件 | 说明 |
| --- | --- | --- |
| `/login` | `pages/login.jsx`(改造) | 账号密码登录,登录后跳 `/chat` |
| `/` | `pages/index.jsx`(改造) | 仅做 `redirect('/chat')` |
| `/chat` | `pages/chat/index.jsx`(新) | 主 chat 界面,要求登录 |
| `/admin/*` | `pages/admin/*`(不动) | 管理后台,沿用老主题 |
| `/launch/*` | `pages/launch/*`(不动) | SSO launch |

### 1.2 API 路由(Next.js)

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/auth/login` | 保留老的 `login(username,password)` 入口(可复用 lib/auth.js) |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/sessions` | 列当前用户的会话,从 `chat_sessions` 表读 |
| POST | `/api/sessions` | 新建会话(title 默认「新会话」,brand 可选) |
| PATCH | `/api/sessions/:id` | 重命名(title 唯一字段,改 title + updated_at) |
| DELETE | `/api/sessions/:id` | 删除一个会话,消息级联删 |
| GET | `/api/sessions/:id/messages` | 分页拉取(默认 limit=100,按 created_at asc) |
| GET | `/api/agent-token` | 签 10 分钟 HS256 JWT(paylod `{sub: supabase userId, exp}`),给 WS 用 |

### 1.3 数据流(用户发一条消息)

```
User 在 Composer 点发送
  ├─ 本地立刻把 {role:user, content} push 到 messages state
  └─ ws.send({conversationId: activeId, content, brand})
        ↓
  agent WebChannel(wss://localhost:4102)
    ├─ 校验 JWT,从 sub 拿 userId
    ├─ 构造 IncomingMsg(channelId:'web', userId, brand, conversationId, content)
    └─ manager.onIncoming(msg) → ConversationManager
          ↓
  AgentRunner 用 streaming 调 Claude API
          ↓
  OutgoingMsg:task_update(delta) → task_done | task_failed
          ↓
  前端 useAgentSocket 收到事件 → 更新 messages state
```

---

## 2. 数据模型(Supabase / Postgres)

新增两张表,都开 RLS。

### 2.1 `chat_sessions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `uuid primary key default gen_random_uuid()` | |
| `user_id` | `uuid not null references auth.users(id) on delete cascade` | |
| `brand` | `text` | 蜜可诗 / 旺鼎阁 / 泰柯茶园,可空 |
| `title` | `text not null default '新会话'` | |
| `created_at` | `timestamptz not null default now()` | |
| `updated_at` | `timestamptz not null default now()` | |

索引: `(user_id, updated_at desc)`
RLS policy: `for all using (auth.uid() = user_id)`

### 2.2 `chat_messages`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `uuid primary key default gen_random_uuid()` | |
| `session_id` | `uuid not null references chat_sessions(id) on delete cascade` | |
| `role` | `text not null check (role in ('user','assistant','system'))` | |
| `content` | `text not null` | 流式场景下:由前端在收到 task_done 后 commit 整段 content |
| `status` | `text` | assistant 行用:`streaming` \| `done` \| `failed` |
| `created_at` | `timestamptz not null default now()` | |

索引: `(session_id, created_at)`
RLS policy: 通过 exists 子查询限定只能读自己 user 的 session 下的消息

---

## 3. 鉴权与 WebSocket

### 3.1 三种 token

1. **Supabase session cookie**:既存机制,负责登录态。Portal 层校验。
2. **agent JWT**:Portal 用 `SUPABASE_JWT_SECRET` 签的 HS256 JWT,寿命 10 分钟,带 `sub`。WS 用。
3. 不引入第三种 token。

### 3.2 端到端 WS 鉴权流程

```
1. 浏览器 GET /api/agent-token
   → middleware 校验 supabase session;中间件未通过 → 401
   → 通过后用 SUPABASE_JWT_SECRET 签 {sub: user.id, exp: now+600}
   → 返回 { token, expiresAt }

2. 浏览器 new WebSocket(`ws://localhost:4102?token=<jwt>`)

3. agent WebChannel.on('connection'):
   ├─ 取 token 参数
   ├─ 不存在 → ws.close(1008, 'missing_token'),return
   ├─ jwt.verify(token, SUPABASE_JWT_SECRET)
   ├─ 失败(过期/伪造)→ ws.close(1008, 'invalid_token'),return
   └─ 通过:用 payload.sub 当 userId,不再从 URL 读 userId

4. ws.on('message') → 构造 IncomingMsg(userId = sub, brand/convId/content 从 JSON)
   → manager.onIncoming(msg)
```

### 3.3 改动文件

- `agent/src/channels/auth.ts`(新):导出 `verifyAgentToken(token): { sub, exp }` / 抛 `INVALID_TOKEN`/`EXPIRED_TOKEN`
- `agent/src/channels/web.ts`(改):connection 事件前置校验,userId 来自 token.sub
- `agent/package.json`(加):`jsonwebtoken`
- `WGD_Portal/lib/agent-token.js`(新):签 token 的 server-only 模块,只在 API route 用
- `WGD_Portal/middleware.js`(新):未登录访问 `/chat` 系列跳 `/login`
- `WGD_Portal/lib/useAgentSocket.js`(新):客户端 hook,封装 token 获取、连接、重连(指数退避 3s/6s/12s、 max 60s);输入字符上限 32000,超出截断并 dispatch 'oversize' 事件

### 3.4 端口与 env

- Portal dev: 3000; Agent HTTP: 4101; Agent WS: 4102
- 共享 secret: `SUPABASE_JWT_SECRET`(supabase 项目的 JWT secret,两边一致)
- 前端 env: `NEXT_PUBLIC_AGENT_WS_URL=ws://localhost:4102`
- 服务端 env: `AGENT_JWT_SECRET`(`agent` 端读这个,`Portal` 端读 `SUPABASE_JWT_SECRET`,两份文件相同值)

---

## 4. 前端 UI

### 4.1 视觉(浅色主题)

- 背景 `#FBFAF7`
- 主文字 `#2D2A26`
- 次文字 `#6B6760`
- 边框 `#E8E4DC`
- 强调橙 `#C96442`
- hover 背景 `#F0EDE5`
- 用户消息气泡 `#2D2A26` + 白色文字,圆角 16px,padding 12px 16px
- 助手消息:无背景框,跟随文档流,最大宽度 720px 居中,Markdown 渲染

老的 glass / neon-cyan / neon-purple 组件保留在 admin 后台,不进入 chat 主题。

### 4.2 布局(三栏)

桌面 ≥ 1024px:

```
[64px icon strip][280px session list][flex — chat area, max-w 720px center]
```

< 1024px: 折叠为两栏(64px + flex),sidebar 通过「新建」按钮 toggle 出现。

### 4.3 组件树

| 组件 | 文件 | 责任 |
| --- | --- | --- |
| `ChatShell` | `components/chat/ChatShell.jsx` | 顶层布局,管 sidebar 折叠、active session |
| `Sidebar` | `components/chat/Sidebar.jsx` | 列表、新建、重命名(hover 铅笔)、删除(hover 垃圾桶,轻量确认)、底部用户区 |
| `MessageList` | `components/chat/MessageList.jsx` | 渲染消息,内含 `MarkdownView` |
| `MarkdownView` | `components/chat/MarkdownView.jsx` | React-Markdown + remark-gfm + rehype-highlight |
| `Composer` | `components/chat/Composer.jsx` | textarea、brand 选择、发送按钮、shift+回车换行 |
| `EmptyState` | `components/chat/EmptyState.jsx` | 空消息时的 logo + 欢迎语 + 三个 canned chip |
| `useAgentSocket` | `lib/useAgentSocket.js` | WS 连接 / 重连 / token 刷新 / 事件分发 |

### 4.4 状态(在 ChatShell)

```js
const [sessions, setSessions] = useState([])
const [activeId, setActiveId] = useState(null)
const [messages, setMessages] = useState([])      // 当前会话
const [streamingBuffer, setStreamingBuffer] = useState('') // 用 ref 也可
const [streaming, setStreaming] = useState(false)
const [connectionState, setConnectionState] = useState('connecting'|'ok'|'reconnecting'|'failed')
```

### 4.5 发送流程(细节)

1. 提交时本地立刻把 `{role:'user', content}` push 到 `messages`(无需等 server)
2. `socket.send({ conversationId: activeId, content, brand })`
3. 收 `task_update` 事件 → 累计到 `streamingBuffer`(本地 ref 或 state)
4. 收 `task_done` → 把 buffer 内容 commit 为 `{role:'assistant', content:buffer}` message;`streaming=false`;清空 buffer
5. 收 `task_failed` → 给最后那条 user message 加失败标记 + 「重试」按钮
6. `onclose`:3 秒后尝试重连;重连前先 `fetch /api/agent-token` 拿新 token;connectionState 反映在顶部小条

### 4.6 空状态

- 无任何 session:sidebar 显示「+ 新建」按钮和说明
- 进了 chat 但当前 session 没消息:中央显示「欢迎语 + 三个 canned chip」,chip 点击后填进 composer(不进 send)

### 4.7 新建 / 重命名 / 删除 session

- 新建:`POST /api/sessions` → 拿 id → setActiveId(id),messages 清空;sidebar 列表更新
- 重命名:hover 出现铅笔 → inline input → blur/enter 提 `PATCH /api/sessions/:id`
- 删除:垃圾桶 → 轻量气泡确认(不是 modal)→ `DELETE /api/sessions/:id` → 若删的是 active,切到列表第一个

### 4.8 应用入口并入 sidebar

sidebar 底部放一个「应用」分区,可访问 admin 后台(只有 admin 角色),以及 launch 子页面。不再造访老的 `/` 应用门户。

---

## 5. 错误处理

| 类型 | 处理 |
| --- | --- |
| WS token 缺失 / 过期 / 伪造 | 服务端 close(1008),前端 hook 重连前刷新 token |
| `system_error` WS 事件 | 顶部 toast「agent 暂时连不上」,最后一条 assistant 标红,显示「重试」按钮 |
| TCP 断网 | hook 状态 `reconnecting`,顶部小条「重连中…」;指数退避 3/6/12/...s,封顶 60s |
| API 401 | 全局跳 `/login`;composer 暂禁用 |
| 用户空消息 | 发送按钮 disabled |
| 内容超过 32k 字符 | 截断 + 红条提示,提交按钮变警示 |
| 流式断在中间(没收到 task_done 也断了) | 重连后,如果 server 端 ConversationManager 没保存中间 buffer,最后那条 assistant 显示「⚠ 回复中断」 |

---

## 6. 测试要点

### 6.1 单元

- `lib/agent-token.js`: `signAgentToken(uid)` 返回的 payload 含 `sub/exp`;`verifyAgentToken` 校验失败抛错
- `lib/useAgentSocket.js`: 模拟 ws 实例,验证重连间隔 / token 刷新 / 事件分发

### 6.2 集成 / API

- `GET /api/sessions` → 未登录 401;登录后只返回当前 user 的
- `POST /api/sessions/:id/messages` → session 不属于自己 → 403
- `GET /api/agent-token` → 未登录 401;登录后返回合法 JWT
- `agent WebChannel`: 无 token close;过期 token close;正确 token `IncomingMsg.userId === sub`

### 6.3 手动 end-to-end(写 verify 脚本)

1. 启 agent(`npm run dev` in `/Users/.../agent`)
2. 启 portal(`npm run dev` in 当前仓库)
3. 登录 → 进 `/chat` → sidebar 空 → 「+ 新建」→ 写一条消息 → 看流式回显
4. 刷新页面 → 历史消息完整
5. 重命名 / 删除会话
6. 停掉 agent → 发消息看到错误态 → 启动 agent → 自动恢复

### 6.4 UI / 视觉

- 主流浏览器 1024px+ 三栏,< 1024px 两栏
- 长 markdown(200+ 行)滚动;代码块横向滚动不破坏布局
- 0 个 session、1 个、10 个会话,sidebar 视觉一致
- 浅色主题:完全移除老 glass / neon 在 chat 页的出现

### 6.5 数据 / RLS

- 用一个 user 的 token 直接查别人的 chat_sessions → 0 行
- supabase SQL editor 切 anon key → 同样 0 行

---

## 7. 风险与权衡

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| JWT 共享 secret 泄漏 | agent 等于 supabase 完整权限 | 用专用环境变量、走 Netlify/部署 secrets,不入 git |
| WS 在 netlify 部署时不被支持 | Netlify Functions 不能跑 ws server | agent 部署到 Fly.io / 自托管 VM / Render,portal 仅承担 HTTP |
| 32k 字符限制 | 用户粘大段上下文失败 | 第一版先收住,后续按需加 chunking |
| 流式断在中间 | 看不到完整回复 | 第一版只显示「回复中断」;V2 在 server 端落 chat_messages.streaming buffer |

## 8. 后续(不做)

- Streaming buffer 持久化(第一版只在 client buffer)
- 多 agent 切换(目前只有默认一个)
- 文件附件上传
- 重生成(retry):第一版只做 user message 级别的重发,不做「↩ 重新生成」

## 9. 依赖变更

- WGD_Portal 加:`react-markdown`、`remark-gfm`、`rehype-highlight`(可选 `highlight.js`)
- agent 加:`jsonwebtoken`、`@types/jsonwebtoken`(dev)
- 不动现有 supabase / framer-motion / tailwind 等

## 10. 文件清单

### 新增(WGD_Portal)

```
pages/chat/index.jsx
pages/api/sessions/index.js
pages/api/sessions/[id].js
pages/api/sessions/[id]/messages.js
pages/api/agent-token.js
middleware.js
components/chat/ChatShell.jsx
components/chat/Sidebar.jsx
components/chat/MessageList.jsx
components/chat/MarkdownView.jsx
components/chat/Composer.jsx
components/chat/EmptyState.jsx
lib/agent-token.js
lib/useAgentSocket.js
supabase/migrations/2026-07-06-chat-tables.sql
```

### 改动(WGD_Portal)

```
pages/login.jsx                       # 主题贴近浅色 claude.ai
pages/index.jsx                       # 改为 redirect('/chat')
lib/auth.js                           # 加 getCurrentUser(req) helper
package.json                          # + react-markdown / remark-gfm / rehype-highlight
next.config.js                        # 如有需要
```

### 新增(agent)

```
src/channels/auth.ts
```

### 改动(agent)

```
src/channels/web.ts                   # JWT 校验,userId 来源变更
src/server.ts                        # 接入 auth.ts,加载 env
package.json                          # + jsonwebtoken / @types/jsonwebtoken
.env.example                          # + AGENT_JWT_SECRET
```
