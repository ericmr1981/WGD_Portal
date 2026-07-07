import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environmentMatchGlobs: [
      ['src/lib/useAgentSocket.test.js', 'jsdom'],
    ],
    globals: true,
    include: ['src/lib/**/*.test.js', 'pages/api/**/*.test.js'],
  },
})
