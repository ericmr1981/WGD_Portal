// scripts/probe-agent-ws-full.mjs
// 端到端探针:连真 Agent,跑完整 user.message → ack → 流式 → message_stop 流
//
// 用法:
//   1. 自签 token(不依赖 portal):
//      node scripts/probe-agent-ws-full.mjs self-sign
//      → 打印 JWKS 到 stdout,可手动设到 Agent 的 AGENT_JWKS_URL
//
//   2. 用 portal 颁发的 token:
//      PROBE_TOKEN='eyJ...' node scripts/probe-agent-ws-full.mjs
//      → 跑完整流程

import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet, jwtVerify } from 'jose'
import { randomUUID } from 'node:crypto'

const AGENT_URL = process.env.AGENT_URL || 'ws://127.0.0.1:4102'
const USER_TEXT = process.env.PROBE_TEXT || '本月蜜可诗营收多少'
const JWKS_FILE = process.env.JWKS_FILE || '/tmp/probe-jwks.json'

const mode = process.argv[2] || (process.env.PROBE_TOKEN ? 'use-token' : 'self-sign')

// ─── mode A: 自签 + 写 JWKS 文件 + 打印 ──────────────────────────

async function selfSignMode() {
  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true })
  const jwk = await exportJWK(publicKey)
  jwk.alg = 'RS256'
  jwk.use = 'sig'
  jwk.kid = 'probe-key-1'

  const jwks = { keys: [jwk] }
  const fs = await import('node:fs/promises')
  await fs.writeFile(JWKS_FILE, JSON.stringify(jwks, null, 2))
  console.log('[jwks] wrote', JWKS_FILE)

  const token = await new SignJWT({ sub: 'probe-user', role: 'admin' })
    .setProtectedHeader({ alg: 'RS256', kid: 'probe-key-1' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey)
  console.log('[token] length=', token.length)
  console.log('TOKEN=' + token)
  console.log('\n--- next steps ---')
  console.log('1. serve this JWKS at a URL the Agent can reach, e.g. start a tiny http server:')
  console.log(`     npx http-server -p 7777  # serve /tmp where probe-jwks.json lives`)
  console.log('     OR: python3 -m http.server 7777 --directory /tmp')
  console.log('2. set Agent env: AGENT_JWKS_URL=http://...:7777/probe-jwks.json  (then restart Agent)')
  console.log('3. re-run with that token:')
  console.log(`     TOKEN='${token.slice(0, 40)}...' node scripts/probe-agent-ws-full.mjs use-token`)
}

// ─── mode B: 用现成 token 跑完整握手 ────────────────────────────────

async function useTokenMode() {
  const token = process.env.PROBE_TOKEN
  if (!token) {
    console.error('need PROBE_TOKEN env or "self-sign" arg')
    process.exit(1)
  }

  console.log('[target]', AGENT_URL)
  console.log('[token] length=', token.length)

  const ws = new WebSocket(AGENT_URL)
  const frames = []
  let closed = null
  let authedOk = false

  ws.addEventListener('open', () => {
    console.log('[open]')
    ws.send(JSON.stringify({ type: 'auth', payload: { token } }))
    console.log('[sent auth]')
  })

  ws.addEventListener('message', (ev) => {
    const data = typeof ev.data === 'string' ? ev.data : ev.data.toString()
    let parsed
    try { parsed = JSON.parse(data) } catch { parsed = null }
    frames.push(parsed || data)

    if (parsed?.type === 'hello') {
      console.log('[hello] protocolVersion=', parsed.payload.protocolVersion, 'sessionId=', parsed.payload.sessionId)
    } else if (parsed?.type === 'ack') {
      console.log('[ack] messageId=', parsed.payload.messageId)
    } else if (parsed?.type === 'message_start') {
      console.log('[message_start] id=', parsed.payload.message.id, 'model=', parsed.payload.message.model)
    } else if (parsed?.type === 'content_block_start') {
      console.log('[content_block_start] index=', parsed.payload.index, 'type=', parsed.payload.content_block.type)
    } else if (parsed?.type === 'content_block_delta') {
      const d = parsed.payload.delta
      const text = d.type === 'text_delta' ? d.text : d.type === 'thinking_delta' ? '[thinking]' : '[json]'
      // 不打印每个字符,改成汇总
      process.stdout.write(text)
    } else if (parsed?.type === 'content_block_stop') {
      console.log('\n[content_block_stop] index=', parsed.payload.index)
    } else if (parsed?.type === 'message_delta') {
      console.log('[message_delta] stop_reason=', parsed.payload.delta.stop_reason, 'usage=', JSON.stringify(parsed.payload.usage))
    } else if (parsed?.type === 'message_stop') {
      console.log('[message_stop]')
    } else if (parsed?.type === 'error') {
      console.log('\n[error]', JSON.stringify(parsed.payload))
    } else if (parsed?.type === 'interrupted') {
      console.log('[interrupted] reason=', parsed.payload.reason)
    } else if (parsed?.type === 'pong') {
      // ignore
    } else if (parsed?.type === 'ping') {
      // auto-pong already done by useAgentSocket; here we just log
      console.log('[ping]')
    } else {
      console.log('[unknown frame]', data.slice(0, 100))
    }
  })

  ws.addEventListener('close', (ev) => {
    closed = { code: ev.code, reason: ev.reason }
    console.log('\n[close]', JSON.stringify(closed))
    // 等一下,如果连接刚建好(还没收到 hello 之前)close,通常是 WS 1008 等价 close
    if (!authedOk && ev.code === 1008) {
      console.log('[hint] auth failed — close 1008 invalid_token')
    }
    done()
  })

  ws.addEventListener('error', (e) => {
    console.log('[error]', e.message || e)
  })

  // 等 hello + 启动 stream 处理后,发 user.message
  let sentUserMsg = false
  const sendUserMsg = setInterval(() => {
    if (sentUserMsg) return
    if (frames.some(f => f?.type === 'hello')) {
      sentUserMsg = true
      clearInterval(sendUserMsg)
      const messageId = randomUUID()
      const msg = {
        type: 'user.message',
        payload: {
          conversationId: null,
          content: USER_TEXT,
          messageId,
          brand: null,
        },
      }
      ws.send(JSON.stringify(msg))
      console.log('[sent user.message] messageId=', messageId)

      // 8s 后还没收到 message_stop 就主动发 user.interrupt 测试取消
      setTimeout(() => {
        if (!frames.some(f => f?.type === 'message_stop')) {
          console.log('[auto-interrupt] 8s 没收到 message_stop,主动发 interrupt')
          ws.send(JSON.stringify({ type: 'user.interrupt', payload: { conversationId: 'auto', reason: 'probe-timeout' } }))
        }
      }, 8000)
    }
  }, 200)

  // 总超时 15s
  setTimeout(() => {
    console.log('\n[timeout] 15s — closing')
    ws.close()
  }, 15000)

  let exited = false
  function done() {
    if (exited) return
    exited = true
    clearInterval(sendUserMsg)
    console.log('\n--- summary ---')
    console.log('frames:', frames.length)
    console.log('closed:', JSON.stringify(closed))
    console.log('frame types:', frames.map(f => f?.type).filter(Boolean).join(','))
    process.exit(0)
  }
}

// ─── 入口 ────────────────────────────────────────────────────────────

if (mode === 'self-sign') {
  selfSignMode()
} else if (mode === 'use-token') {
  useTokenMode()
} else {
  console.error('usage: probe-agent-ws-full.mjs <self-sign|use-token>')
  process.exit(1)
}