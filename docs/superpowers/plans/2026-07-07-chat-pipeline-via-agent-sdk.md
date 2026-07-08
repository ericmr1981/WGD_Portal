# Chat Pipeline 补全 — 通过 agent SDK 继承会话(支持多 session)

日期: 2026-07-07
状态: 补全计划(待批准)
前置: `docs/superpowers/plans/2026-07-06-wgd-portal-agent-chat-redesign.md`
关联: `docs/superpowers/specs/2026-07-06-wgd-portal-agent-chat-redesign.md`

## 背景

原 spec 假设 portal 自建 `chat_sessions`/`chat_messages` 表,与 agent 的 `agent.conversations`/`agent.messages` 两套并存。**实证后这是错的:**

- agent 仓库 DDL 在 `sql/00_agent_schema.sql`,**自带**完整会话存储(`agent.conversations` / `agent.messages` 等),已经被 ConversationManager 使用
- 实测 agent 运行起来后,portal 发消息 → agent 立即报 `relation "agent.conversations" does not exist` (本机 dev 没建过 schema)
- portal 自己的表用 RLS 锁用户,而 agent 用 `user_id` TEXT 字段 + 直接 SQL — 两套**完全不兼容**
- portal 那两张表完全冗余,因为 agent 才是会话数据源

**正确做法:** portal 不存 session,通过 agent 暴露的 HTTP SDK 读 agent schema 的 conversation;portal 只负责 WS 连接 + 流式渲染 + UI。多 session 由 agent 一侧统一管理。

## 目标

- portal 把"会话"完全委托给 agent
- agent 加一组 user-facing HTTP 路由(已有 admin 路由风格),供 portal 当 SDK 调
- 删除 portal 端冗余表与对应 API 路由
- 登录环节延后(用 dev-login 占位)

## 范围之外

- 不动 agent 的 ConversationManager 核心(只加 1-2 个 read 方法)
- 不重做登录(用 dev-login 绕过,真登录最后做)
- 不改 agent 的 tasks/cron/mcp
- 不动 admin 后台

---

## A. agent 仓库改动(分支 `SalesDatacheck`)

### A.1 新增 `ConversationManager` 只读方法

`agent/src/conversation/manager.ts`:

- 加 `listByUser(userId, limit=50): Promise<Conversation[]>` — 按 `user_id` 查 `agent.conversations`,`status='active'`,按 `last_active_at DESC`
- 加 `rename(id, title)` — 但 `agent.conversations` 表没有 `title` 字段,**改用 `summary` 字段做名字** 或加一列 `title TEXT`
  - **决策:** 加一列 `title TEXT DEFAULT '新会话'`(避免和 `summary` 混淆)
- 加 `archive(id)` — `UPDATE ... SET status='archived'`(软删,保留 history)
- 加 `getOne(id, userId)` — 校验所有权后返回单条 conversation

### A.2 migration: 给 `agent.conversations` 加 `title`

`agent` 仓库新增 DDL(或直接放 `sql/` 目录):

```sql
ALTER TABLE agent.conversations ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '新会话';
```

### A.3 新增 user-facing HTTP 路由

新文件 `agent/src/api/conversations.ts`,导出 `registerConversationRoutes(app, conversation)`:

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/api/conversations` | `conversation.listByUser(userId)` |
| POST | `/api/conversations` | 创建空会话(返回 conversationId + title) |
| PATCH | `/api/conversations/:id` | rename(校验 ownership) |
| DELETE | `/api/conversations/:id` | archive(校验 ownership) |
| GET | `/api/conversations/:id/messages` | `conversation.getMessages(id, 100)`(校验 ownership) |

**鉴权:** 路由从请求头 `x-user-id` 或 `authorization: Bearer <jwt>` 取 userId。
- **决策:** 用同一个 agent JWT(已经有 `signAgentToken`/`verifyAgentToken`),portal 调时把 WS 那个 token 也带上,agent 解出 `sub` 当 userId。**零新机制,复用现有。**

### A.4 在 `server.ts` 注册

```typescript
import { registerConversationRoutes } from './api/conversations.js'
registerConversationRoutes(app, conversation)
```

---

## B. portal 仓库改动(分支 `dev`)

### B.1 删除冗余 schema 与 API

- 删 `supabase/migrations/2026-07-06-chat-tables.sql`(从未执行,直接 rm)
- 删 `pages/api/sessions/index.js`、`pages/api/sessions/[id].js`、`pages/api/sessions/[id]/messages.js` 及其 `.test.js`
- 删 `src/lib/auth.js` 里 `getCurrentUser` 改用**直接调 agent SDK**(不再解析 wgd_session cookie 做用户查找)— 仍保留 cookie 检测只为了"是否登录"
- **portal `chat_sessions` 表概念整体废弃**

### B.2 改造 portal `/api/sessions/*` 为 agent SDK 代理

新文件 `pages/api/sessions/index.js` 等,改为**反向代理到 agent HTTP**:

```js
// pages/api/sessions/index.js
import { getCurrentUser } from '../../src/lib/auth.js'

const AGENT_BASE = process.env.AGENT_HTTP_URL || 'http://localhost:4101'

export default async function handler(req, res) {
  const user = getCurrentUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  const token = signAgentToken(user.id).token   // 短期 JWT,带 sub
  const r = await fetch(`${AGENT_BASE}${req.url.replace('/api/sessions','/api/conversations')}`, {
    method: req.method,
    headers: { 'authorization': `Bearer ${token}`, 'content-type': 'application/json' },
    body: ['POST','PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
  })
  res.status(r.status).send(await r.text())
}
```

> 注意:这是个**透传代理**,portal 仅做 cookie → JWT 转换。`[id]/messages` 同模式。

### B.3 dev-login 占位

新文件 `pages/api/auth/dev-login.js`、`pages/api/auth/dev-logout.js`(dev-only,`NODE_ENV !== 'production'`):
- POST `/api/auth/dev-login { userId, name }` → set `wgd_session` cookie → 200
- POST `/api/auth/dev-logout` → clear cookie → 200

### B.4 ChatShell 调整

- `sendMessage` 不再"先 POST /api/sessions 建一个再 send",改为**直接 WS send 时 `conversationId: null`** — agent `getOrCreate` 会自动建并返回 conversationId(通过 `task_update` 事件回传),sidebar 在收到时刷新
- 或者:**点新建按钮**才建 session(显式),发送时 activeId 不空就直发,空就提示先建会话

### B.5 删除单测里的 sessions 测试

旧测试基于 supabase mock,已不适用 → 删 `pages/api/sessions/index.test.js` 等(或改为 mock fetch 到 agent 的方式)

---

## C. 端到端验证步骤

1. 在 agent DB 跑 `sql/00_agent_schema.sql` + 新 `title` 列迁移
2. agent dev 已在 4101/4102 跑(确认中)
3. portal dev 跑在 4100,带 `SUPABASE_JWT_SECRET` + `AGENT_HTTP_URL=http://localhost:4101`
4. 浏览器访问 `http://localhost:4100/api/auth/dev-login` POST `{"userId":"u1","name":"Test"}` 拿 cookie
5. 访问 `/chat`,看 sidebar 是否空
6. 点「+ 新建」→ 看 sidebar 出现一条
7. 发消息「上月蜜可诗 GMV 多少?」→ 看 WS 流式回显
8. 刷新页面 → 历史消息仍在
9. 重命名 / 删除会话

## D. 风险

| 风险 | 缓解 |
| --- | --- |
| agent schema 在 supabase 项目里没建过 | 你需要手工跑 `sql/00_agent_schema.sql` + 加 title 列 |
| portal 透传代理遇到跨域 | 同源,无跨域 |
| `title` 字段语义和 `summary` 混淆 | 加列时注释清楚,title 是 UI 显示名,summary 是 LLM 压缩 |
| dev-login cookie 跑通后,真登录可能与中间件冲突 | 真登录用同样 cookie 名 `wgd_session`,中间件不动 |
| agent 4101/4102 dev 已启动,改 agent 代码需要重启 | 注意重启流程 |

## E. 实施顺序(建议)

1. agent 加 `title` 列 + 4 个 SDK 路由 + 注册(改 3 个文件)
2. agent 重启
3. portal 删冗余 + 改 sessions 透传(改 4 个文件)
4. portal 加 dev-login
5. ChatShell 调整 send 流程
6. 浏览器跑 Step C 验证

## F. 需要你拍板的 3 件事

1. **`title` 字段**:加列还是复用 `summary`?(推荐加列,语义干净)
2. **dev-login 是否接受**:是临时导线,不上生产
3. **agent 当前跑的实例要不要重启**:A.1-A.4 改完需要重启 agent dev server 才生效
