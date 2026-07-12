/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
}

module.exports = nextConfig

// WS 直连 VM 内 Agent 127.0.0.1:4102，不再需要 gvproxy 代理。
