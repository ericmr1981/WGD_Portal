import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSession, isAdmin } from '../../lib/auth'
import GlassNav from '../../components/GlassNav'
import AdminSidebar from '../../components/AdminSidebar'
import GlassCard from '../../components/GlassCard'
import { loadApps, getConfig } from '../../lib/data'
import { getUsers } from '../../lib/auth'

export default function AdminPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!getSession()) {
      router.replace('/login')
    } else if (!isAdmin()) {
      router.replace('/')
    } else {
      setAuthorized(true)
    }
  }, [])

  if (!authorized) return null

  const users = getUsers()
  const apps = loadApps()
  const config = getConfig()

  return (
    <div className="min-h-screen flex flex-col">
      <GlassNav />
      <div className="flex flex-1 overflow-x-hidden">
        {/* Mobile sidebar toggle */}
        <button onClick={() => setSidebarOpen(true)}
                className="sm:hidden fixed left-3 bottom-20 z-30 glass rounded-full w-12 h-12 flex items-center justify-center text-lg shadow-lg">
          📋
        </button>
        <AdminSidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 p-6 overflow-x-hidden max-w-full">
          <h1 className="text-2xl font-bold text-white mb-6">管理概览</h1>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <GlassCard>
              <p className="text-gray-400 text-sm mb-1">用户总数</p>
              <p className="text-3xl font-bold text-white">{users.length}</p>
            </GlassCard>
            <GlassCard>
              <p className="text-gray-400 text-sm mb-1">应用总数</p>
              <p className="text-3xl font-bold text-white">{apps.length}</p>
            </GlassCard>
            <GlassCard>
              <p className="text-gray-400 text-sm mb-1">分类数</p>
              <p className="text-3xl font-bold text-white">{config.categories.length}</p>
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassCard className="cursor-pointer hover:border-neon-cyan/30" onClick={() => router.push('/admin/users')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">用户管理</p>
                  <p className="text-white text-sm mt-1">添加、编辑或删除用户</p>
                </div>
                <span className="text-2xl">👥</span>
              </div>
            </GlassCard>
            <GlassCard className="cursor-pointer hover:border-neon-cyan/30" onClick={() => router.push('/admin/apps')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">应用管理</p>
                  <p className="text-white text-sm mt-1">管理应用列表和排序</p>
                </div>
                <span className="text-2xl">📦</span>
              </div>
            </GlassCard>
          </div>
        </main>
      </div>
    </div>
  )
}
