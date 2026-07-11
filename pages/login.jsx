import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../src/lib/supabase'

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
      // 直接调 Supabase RPC 验证密码(走 public.users + bcrypt)
      const { data, error: rpcErr } = await supabase.rpc('login_user', {
        p_username: username,
        p_password: password,
      })
      if (rpcErr) throw rpcErr
      if (!data?.success) {
        setError(data?.error || '账号或密码错误')
        setLoading(false)
        return
      }
      const user = data.user
      const session = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      }
      // 写 localStorage (供 admin 页 getSession 使用) + cookie (供 middleware + API getCurrentUser 使用)
      localStorage.setItem('wgd_session', JSON.stringify(session))
      const encoded = encodeURIComponent(JSON.stringify(session))
      document.cookie = `wgd_session=${encoded}; path=/; SameSite=Lax; max-age=604800`
      const dest = typeof router.query.from === 'string' ? router.query.from : '/chat'
      router.push(dest)
    } catch (err) {
      console.error('Login error:', err)
      setError(`登录失败:${err.message || '网络错误'}`)
    }
    setLoading(false)
  }

  return (
    <div className="chat-root min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-paper border border-line rounded-2xl shadow-sm p-8 sm:p-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-claude/10 mb-3">
            <span className="text-claude text-xl">✦</span>
          </div>
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
              autoComplete="username"
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
              autoComplete="current-password"
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