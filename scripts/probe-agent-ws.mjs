// scripts/probe-agent-ws.mjs
// 最小化探针:连 ws://localhost:4102,观察 hello,再用伪造 token 试 auth 看服务端怎么反应
// 不需要任何依赖,纯 Node 22 globalThis.WebSocket

const URL = process.env.PROBE_URL || 'ws://127.0.0.1:4102'
const TOK = process.env.PROBE_TOKEN || ''

const frames = []
let closed = null

const ws = new WebSocket(URL)

ws.addEventListener('open', () => {
  console.log('[open]', URL)
  if (TOK) {
    ws.send(JSON.stringify({ type: 'auth', payload: { token: TOK } }))
    console.log('[sent auth] token len=', TOK.length)
  } else {
    console.log('[skip auth] no PROBE_TOKEN')
  }
})

ws.addEventListener('message', (ev) => {
  const data = typeof ev.data === 'string' ? ev.data : ev.data.toString()
  frames.push(data)
  console.log('[frame]', data.length > 200 ? data.slice(0, 200) + '...' : data)
})

ws.addEventListener('close', (ev) => {
  closed = { code: ev.code, reason: ev.reason }
  console.log('[close]', JSON.stringify(closed))
  done()
})

ws.addEventListener('error', (e) => {
  console.log('[error]', e.message || e)
})

setTimeout(() => {
  console.log('[timeout] frames=', frames.length)
  if (frames.length === 0) {
    console.log('No frames received. Last close=', closed)
    process.exit(1)
  }
  ws.close()
}, 5000)

let exited = false
function done() {
  if (exited) return
  exited = true
  console.log('--- summary ---')
  console.log('frames:', frames.length)
  console.log('closed:', JSON.stringify(closed))
  process.exit(0)
}