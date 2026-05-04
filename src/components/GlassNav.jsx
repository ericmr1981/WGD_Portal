import { useRouter } from 'next/router'
import { getSession, logout, isAdmin } from '../lib/auth'
import { useState } from 'react'

export default function GlassNav() {
  const router = useRouter()
  const session = getSession()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <nav className="glass border-b border-white/5 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <button onClick={() => router.push('/')} className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-cyan to-neon-purple" />
          <span className="text-white font-bold text-lg">WGD Portal</span>
        </button>

        {/* Desktop right */}
        <div className="hidden sm:flex items-center gap-4">
          {isAdmin() && (
            <button
              onClick={() => router.push('/admin')}
              className={`text-sm transition-colors ${
                router.pathname.startsWith('/admin') ? 'text-neon-cyan' : 'text-gray-400 hover:text-white'
              }`}
            >
              管理后台
            </button>
          )}
          <span className="text-sm text-gray-300">{session?.name}</span>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center text-white text-sm font-medium">
            {session?.name?.charAt(0) || 'U'}
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-white transition-colors">
            退出
          </button>
        </div>

        {/* Mobile hamburger */}
        <button className="sm:hidden text-white text-2xl" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden glass border-t border-white/5 px-4 py-4 space-y-3">
          <div className="flex items-center gap-3 pb-3 border-b border-white/5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center text-white text-sm font-medium">
              {session?.name?.charAt(0) || 'U'}
            </div>
            <div>
              <p className="text-white text-sm">{session?.name}</p>
              <p className="text-gray-500 text-xs">{session?.role === 'admin' ? '管理员' : '员工'}</p>
            </div>
          </div>
          {isAdmin() && (
            <button onClick={() => { router.push('/admin'); setMenuOpen(false) }}
                    className="block w-full text-left text-sm text-gray-300 py-2">
              管理后台
            </button>
          )}
          <button onClick={handleLogout} className="block w-full text-left text-sm text-gray-500 py-2">
            退出登录
          </button>
        </div>
      )}
    </nav>
  )
}
