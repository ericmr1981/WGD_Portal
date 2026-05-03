import { useState } from 'react'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { login } from '../lib/auth'
import GlassInput from '../components/GlassInput'
import GlassButton from '../components/GlassButton'

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
      const session = await login(username, password)
      if (session) {
        router.push('/')
      } else {
        setError('账号或密码错误')
      }
    } catch {
      setError('登录失败，请重试')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="glass rounded-2xl p-8 sm:p-10 w-full max-w-sm border border-neon-cyan/20 neon-glow"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-neon-cyan to-neon-purple
                          shadow-[0_0_20px_rgba(0,212,255,0.3)]" />
          <h1 className="text-2xl font-bold text-white">WGD Portal</h1>
          <p className="text-gray-500 text-sm mt-1">公司应用门户</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className={error ? 'animate-[shake_0.3s_ease]' : ''}>
            <GlassInput
              label="账号"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入账号"
            />
          </div>
          <div className={error ? 'animate-[shake_0.3s_ease]' : ''}>
            <GlassInput
              label="密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <GlassButton type="submit" className="w-full" disabled={loading}>
            {loading ? '登录中...' : '登 录'}
          </GlassButton>
        </form>
      </motion.div>
    </div>
  )
}
