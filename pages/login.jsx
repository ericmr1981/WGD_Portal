import { useState } from 'react'
import { useRouter } from 'next/router'

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
      // Call new auth API
      const r = await fetch('/api/auth/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })
      if (!r.ok) {
        throw new Error('登录失败')
      }
      const data = await r.json()
      // Set wgd_session cookie for backward compatibility with /api/sessions routes
      const session = {
        id: data.user.id,
        username: data.user.username,
        name: data.user.username,
        role: data.user.role,
      }
      const encoded =encodeURIComponent(JSON.stringify(session))
      const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      document.cookie = `wgd_session=${encoded}; path=/; SameSite=Lax; max-age=${d.getTime() >> 10}`
      const dest = typeof router.query.from === 'string' ? router.query.from : '/chat'
      router.push(dest)
    } catch {
      setError('账号或密码错误')
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
