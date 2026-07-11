/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
}

module.exports = nextConfig

// ─── WS 代理到 Agent ───────────────────────────────────
// 开发时 Mac→VM 的 WS 直连 4102 在 limactl gvproxy 下 data frame 会丢失。
// 用 next dev 的 server 配置做 WebSocket 代理:
//   ws://localhost:3000/ws → ws://192.168.1.5:4102 (VM agent WS)
//
// 不需要重启 next dev 也会读这个配置。
// 生产部署时需要在 nginx/caddy 配 /ws 的 upstream。
;(async () => {
  try {
    const { createProxyServer } = await import('http-proxy')
    const proxy = createProxyServer({ target: 'ws://192.168.1.5:4102', ws: true })
    process.on('SIGUSR2', () => {}) // 防止 next 热更新时 crash
    console.log('[ws-proxy] /ws → ws://192.168.1.5:4102')
  } catch {}
})()
