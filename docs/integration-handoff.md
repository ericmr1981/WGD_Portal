# Agent dev:把 AGENT_JWKS_URL 改到 portal

## 上下文

Portal 端 RS256 token 已就绪:
- 端点:`http://<mac-or-lima-host>:3000/api/auth/jwks.json`(返回 `{keys:[{kty:'RSA',alg:'RS256',use:'sig',kid,kty,n,e,...}]}`)
- 私钥在 `portal/src/lib/agent-token.ts` 内存里(启动时生成一次,HMR 缓存)
- Token 由 `portal/pages/api/agent-token` 返回,sub=user.id,exp=10min
- Portal `/api/sessions/*` 已切到用 portal 自签 RS256 token 转发给 Agent

之前 Agent 端的 `verifyAgentToken` 已切到 RS256 + JWKS(`agent/src/channels/auth.ts`),alg 写错 ES256 已修。

**现在 Agent 端就缺最后一步**:把 `AGENT_JWKS_URL` env 从 Supabase JWKS 改成 portal JWKS。

## 步骤

### 1. 决定 JWKS URL

在 VM 里测试从 Agent 看 portal 的可达性:

```bash
# 如果 portal 在 mac 上的 next dev 跑,VM 看 mac 有几种方式:
# - Lima VM 通常能解析 host.lima.internal(指向 mac host)
curl http://host.lima.internal:3000/api/auth/jwks.json  # 期望 200 + JSON

# 兜底:用 mac 的 LAN IP(portal dev 启动后会显示)
curl http://192.168.1.5:3000/api/auth/jwks.json            # 期望 200 + JSON
```

哪个通就用哪个。

### 2. 改 Agent env

部署 Agent 服务的 env 文件(可能是 `/etc/wdg/agent.env` 或类似 systemd unit 的 `EnvironmentFile=`)。

**改成**:
```bash
# 删(路 1 不再需要)
# SUPABASE_ISSUER=...
# SUPABASE_AUDIENCE=...

# 改(指向 portal 的 JWKS 端点)
AGENT_JWKS_URL=http://host.lima.internal:3000/api/auth/jwks.json
# 兜底如果 host.lima.internal 不通:
# AGENT_JWKS_URL=http://192.168.1.5:3000/api/auth/jwks.json
```

### 3. 重启 Agent

```bash
sudo systemctl restart wdg-agent
# 验活
curl -s http://127.0.0.1:4101/health
```

### 4. 冒烟:Agent 端能否拉到 JWKS

如果 Agent 重启后健康 OK,不需要额外验证。`createRemoteJWKSet` 会自动缓存并刷新。如果 portal 端 JWKS 公钥变化(portal 重启会生成新 key 对),需要等 Agent 端 jose 缓存过期(默认 10 分钟)或者重启 Agent。

## 期望效果

改完后,我(在 portal 仓库里)用以下 probe 跑完整端到端:

```bash
node scripts/probe-portal-token.mjs
# 期望:[conversations] 200 / [messages] 200
# 而不再是 401

# 然后再跑:
PROBE_TOKEN='<portal-issued>' node scripts/probe-agent-ws-full.mjs use-token
# 期望:hello → ack → message_start → 多个 text_delta → message_stop
```

## 注意

- portal 端私钥**只在 portal 进程内存**,portal 重启会生成新 key 对,Agent 端 jose 缓存会过期失败。如果 portal 频繁重启,Agent 端也需要随之重启,或临时禁用 jose 缓存(后续优化)。
- 当前 mac 上 portal dev 跑在 3000 端口(我刚启动)。portal dev 关掉或重启后,Agent 端会断联。
- 这一步完成 = 路 1 端到端联调打通,可执行 [alignment-and-checklist.md](file:///Users/ericmr/Documents/GitHub/wdg-data-foundation/docs/alignment-and-checklist.md) §4 全套联调清单。