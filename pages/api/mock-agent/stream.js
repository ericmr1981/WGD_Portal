// pages/api/mock-agent/stream.js
// Mock agent SSE 端点 —— 仅在 NEXT_PUBLIC_USE_MOCK_AGENT=1 时由 ChatShell 调用。
// 返回标准 Anthropic Messages API envelope 流(hello → ack → content_block_delta...)。
//
// 真实场景下:客户端走 WS 直连 Agent 服务,见 spec-chat-portal.md §B.4。
// 这里把 WS 模拟为 SSE,只为了本地无 Agent 时能跑通新协议 UI 渲染。

import { getCurrentUser } from '../../../src/lib/auth'

// GET 请求默认就不解析 body,不要显式设 bodyParser:false —— 那会触发 Next 14 某些路径的 400。
// SSE 长连接只要正确设置响应头并 flushHeaders 即可。
export const config = {
  api: {
    responseLimit: false,
  },
}

const PROTOCOL_VERSION = 1

/**
 * 按字符粒度推送一段文本:模拟 LLM 的 text_delta 流。
 * 返回 abort 函数 —— 调用方(用户中断)可以随时打断。
 */
function streamText(text, send, intervalMs = 18) {
  let cancelled = false
  let i = 0
  return {
    abort: () => {
      cancelled = true
    },
    promise: (async () => {
      for (const ch of text) {
        if (cancelled) return
        send({
          type: 'content_block_delta',
          payload: { index: 0, delta: { type: 'text_delta', text: ch } },
        })
        await new Promise((r) => setTimeout(r, intervalMs))
        i++
      }
    })(),
  }
}

// mock 的回复模板 —— 按用户输入关键词路由
function pickReply(userText) {
  const t = (userText || '').toLowerCase()
  if (/营收|收入|sales|revenue/.test(t)) {
    return [
      '本月各品牌营收(单位:万元):',
      '',
      '- 蜜可诗:128.4 (环比 +6.2%)',
      '- 旺鼎阁:96.1 (环比 -1.8%)',
      '- 泰柯茶园:73.5 (环比 +12.4%)',
      '',
      '同比去年 +14.2%。其中泰柯茶园增幅最大,主要来自夏季新品上市。',
    ].join('\n')
  }
  if (/余额|balance|账户/.test(t)) {
    return [
      '当前各账户余额:',
      '',
      '- 工商银行(主): ¥ 482,310.55',
      '- 招商银行: ¥ 156,022.18',
      '- 支付宝企业账户: ¥ 73,901.00',
      '',
      '合计: ¥ 712,233.73。工行主账户余额偏低,建议下周回款后转入。',
    ].join('\n')
  }
  if (/thinking|思考|extended/.test(t)) {
    return '好的,我把 thinking 块打开看看 —— 这段文字应该来自一个 thinking 块(默认折叠)。'
  }
  if (/tool|工具/.test(t)) {
    return '演示 tool_use:我会调用一个名为 query_db 的工具,然后把结果汇总给你。'
  }
  if (/error|报错|失败/.test(t)) {
    return null // 触发错误演示
  }
  if (/拒绝|refusal/.test(t)) {
    return '__refusal__' // 触发 refusal 演示
  }
  // 默认回复
  return `我收到了你的消息:"${userText}"。

这是一个 mock agent 的回复,用于演示新协议 (v${PROTOCOL_VERSION}) 的流式渲染。
每条 \`content_block_delta\` 都会立即推送到前端,前端打字机效果由 reducer 累积产生。
- 整体设计见 spec-chat-agent.md / spec-chat-portal.md
- 联调清单见 alignment-and-checklist.md`
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  const user = getCurrentUser(req)
  if (!user) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  // 调试输出 —— 帮助定位 400 原因
  console.log('[mock-stream] hit, method=', req.method, 'url=', req.url)

  const url = new URL(req.url, 'http://localhost')
  const userText = url.searchParams.get('text') || ''
  const conversationId = url.searchParams.get('conversationId') || null
  const clientMessageId = url.searchParams.get('messageId') || ''

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const send = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`)
  }

  // 1. hello(协议握手)
  send({
    type: 'hello',
    payload: { protocolVersion: PROTOCOL_VERSION, sessionId: user.id },
  })

  // 2. ack(用户消息确认)
  if (clientMessageId) {
    send({ type: 'ack', payload: { messageId: clientMessageId, ts: Date.now() } })
  }

  // 3. 看是否触发错误演示
  if (userText.match(/error|报错|失败/i)) {
    send({
      type: 'error',
      payload: {
        code: 'bad_request',
        http_status: 400,
        message: '(mock) 演示错误分类:bad_request',
      },
    })
    return res.end()
  }

  if (userText.match(/拒绝|refusal/i)) {
    send({
      type: 'message_start',
      payload: {
        message: {
          id: `msg_mock_${Date.now()}`,
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-8 (mock)',
          content: [],
          stop_reason: null,
          usage: { input_tokens: 12, output_tokens: 0 },
        },
      },
    })
    send({
      type: 'message_delta',
      payload: {
        delta: { stop_reason: 'refusal' },
        usage: { output_tokens: 0 },
      },
    })
    send({
      type: 'error',
      payload: {
        code: 'refusal',
        http_status: 200,
        category: 'cyber',
        message: '(mock) 此请求因安全策略被拒绝',
      },
    })
    send({ type: 'message_stop', payload: {} })
    return res.end()
  }

  const reply = pickReply(userText)
  const messageId = `msg_mock_${Date.now()}`

  // 4. message_start
  send({
    type: 'message_start',
    payload: {
      message: {
        id: messageId,
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-4-8 (mock)',
        content: [],
        stop_reason: null,
        usage: { input_tokens: 42, output_tokens: 0 },
      },
    },
  })

  // 5. 可选:thinking 块(对含 thinking 关键词的输入)
  if (/thinking|思考|extended/i.test(userText)) {
    send({
      type: 'content_block_start',
      payload: {
        index: 0,
        content_block: { type: 'thinking', thinking: '' },
      },
    })
    const thinking = '用户希望看到 thinking 块的渲染效果。我应该:(1) 先发一个 thinking 块;(2) 里面写一段思考;(3) 然后再发 text 块回答。'
    for (const ch of thinking) {
      send({
        type: 'content_block_delta',
        payload: {
          index: 0,
          delta: { type: 'thinking_delta', thinking: ch },
        },
      })
      await new Promise((r) => setTimeout(r, 8))
    }
    send({ type: 'content_block_stop', payload: { index: 0 } })
  }

  // 6. text 块(text_index = 0 if no thinking, else 1)
  const textIndex = /thinking|思考|extended/i.test(userText) ? 1 : 0

  // 可选:tool_use(对含 tool 关键词的输入)—— 简化为直接流式 text
  // 这里仅做演示,真实场景 SDK 会推 input_json_delta,这里走简化路径

  send({
    type: 'content_block_start',
    payload: {
      index: textIndex,
      content_block: { type: 'text', text: '' },
    },
  })

  // 流式推文本
  const stream = streamText(reply, send, 14)

  // 中断处理:客户端断开 / mock inbound 收到 user.interrupt 都取消
  let aborted = false
  const onAbort = () => {
    if (aborted) return
    aborted = true
    stream.abort()
    try {
      send({ type: 'interrupted', payload: { conversationId, reason: 'user' } })
    } catch {
      /* res 已关闭 */
    }
    res.end()
  }
  req.on('close', () => onAbort())

  // 暴露 abort 给同进程的 /api/mock-agent/inbound
  registerAbort(conversationId, onAbort)

  try {
    await stream.promise
  } catch {
    /* stream 中断 */
  } finally {
    unregisterAbort(conversationId)
  }

  if (aborted) return

  send({ type: 'content_block_stop', payload: { index: textIndex } })
  send({
    type: 'message_delta',
    payload: {
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: reply.length },
    },
  })
  send({ type: 'message_stop', payload: {} })
  res.end()
}

// ─── 全局 abort 句柄映射(同进程内 mock SSE 与 inbound 通信) ────────
// @ts-nocheck —— 这个 .js 文件夹了一段 TypeScript-flavored 类型注释,
/* eslint-disable */
const g = /** @type {any} */ (globalThis)
const abortMap = g.__mockAbortMap__ || (g.__mockAbortMap__ = new Map())

function registerAbort(conversationId, fn) {
  if (!conversationId) return
  abortMap.set(conversationId, fn)
  // 60s 自动清理
  setTimeout(() => abortMap.delete(conversationId), 60_000)
}

function unregisterAbort(conversationId) {
  if (!conversationId) return
  abortMap.delete(conversationId)
}

export function triggerMockAbort(conversationId) {
  const fn = abortMap.get(conversationId)
  if (fn) {
    fn()
    abortMap.delete(conversationId)
    return true
  }
  return false
}