import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSession, isAdmin } from '../../src/lib/auth'
import AdminTopBar from '../../src/components/admin/AdminTopBar'
import AdminSideNav from '../../src/components/admin/AdminSideNav'
import AdminCard from '../../src/components/admin/AdminCard'
import { getApps, getConfig, getUsers } from '../../src/lib/data'

const sidebarItems = [
  { id: 'overview', label: '概览', icon: '📊' },
  { id: 'users', label: '用户管理', icon: '👥' },
  { id: 'apps', label: '应用管理', icon: '📦' },
  { id: 'prompts', label: '提示卡片', icon: '💬' },
]

export default function AdminPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [users, setUsers] = useState([])
  const [apps, setApps] = useState([])
  const config = getConfig()

  useEffect(() => {
    if (!getSession()) { router.replace('/login'); return }
    if (!isAdmin()) { router.replace('/'); return }
    setAuthorized(true)
    getUsers().then(setUsers)
    getApps().then(setApps)
  }, [])

  const navigate = (id) => {
    if (id === 'overview') router.push('/admin')
    else if (id === 'users') router.push('/admin/users')
    else if (id === 'apps') router.push('/admin/apps')
    else if (id === 'prompts') router.push('/admin/prompts')
  }

  if (!authorized) return null

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <AdminTopBar title="管理概览" />
      <div className="flex flex-1">
        <AdminSideNav
          active="overview"
          items={sidebarItems}
          onNavigate={navigate}
        />
        <main className="flex-1 p-6">
          <h2 className="text-xl font-semibold text-ink mb-6">概览</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <AdminCard
              title="用户总数"
              subtitle={users.length}
              icon="👥"
            />
            <AdminCard
              title="应用总数"
              subtitle={apps.length}
              icon="📦"
            />
            <AdminCard
              title="分类数"
              subtitle={config.categories.length}
              icon="🏷️"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AdminCard
              title="用户管理"
              subtitle="添加、编辑或删除用户"
              icon="👥"
              onClick={() => navigate('users')}
            />
            <AdminCard
              title="应用管理"
              subtitle="管理应用列表和排序"
              icon="📦"
              onClick={() => navigate('apps')}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
