import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSession, isAdmin } from '../../src/lib/auth'
import AdminTopBar from '../../src/components/admin/AdminTopBar'
import AdminSideNav from '../../src/components/admin/AdminSideNav'
import AdminCard from '../../src/components/admin/AdminCard'
import AdminInput from '../../src/components/admin/AdminInput'
import AdminButton from '../../src/components/admin/AdminButton'
import AdminModal from '../../src/components/admin/AdminModal'
import { getUsers, createUser, updateUser, deleteUser, resetPassword } from '../../src/lib/data'

const emptyForm = { username: '', password: '', name: '', role: 'user' }

const sidebarItems = [
  { id: 'overview', label: '概览', icon: '📊' },
  { id: 'users', label: '用户管理', icon: '👥' },
  { id: 'apps', label: '应用管理', icon: '📦' },
  { id: 'prompts', label: '提示卡片', icon: '💬' },
]

export default function AdminUsersPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [users, setUsers] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    if (!getSession()) { router.replace('/login'); return }
    if (!isAdmin()) { router.replace('/'); return }
    setAuthorized(true)
    loadUsers()
  }, [])

  const loadUsers = async () => {
    const result = await getUsers()
    setUsers(result)
  }

  const handleSave = async () => {
    if (!form.username.trim() || !form.name.trim()) return
    if (modal.mode === 'add' && !form.password.trim()) return

    if (modal.mode === 'add') {
      await createUser({
        username: form.username,
        password: form.password,
        name: form.name,
        role: form.role,
      })
    } else {
      await updateUser(modal.user.id, { name: form.name, role: form.role })
      if (form.password) {
        await resetPassword(modal.user.id, form.password)
      }
    }

    await loadUsers()
    setModal(null)
    setForm(emptyForm)
  }

  const handleDelete = async () => {
    await deleteUser(deleteTarget.id)
    await loadUsers()
    setDeleteTarget(null)
  }

  const openEdit = (user) => {
    setForm({ username: user.username, password: '', name: user.name, role: user.role })
    setModal({ mode: 'edit', user })
  }

  const navigate = (id) => {
    if (id === 'overview') router.push('/admin')
    else if (id === 'apps') router.push('/admin/apps')
    else if (id === 'prompts') router.push('/admin/prompts')
  }

  if (!authorized) return null

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <AdminTopBar title="用户管理" />
      <div className="flex flex-1">
        <AdminSideNav
          active="users"
          items={sidebarItems}
          onNavigate={navigate}
        />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-ink">用户列表</h2>
            <AdminButton onClick={() => { setForm(emptyForm); setModal({ mode: 'add' }) }}>
              + 添加用户
            </AdminButton>
          </div>

          <div className="space-y-3">
            {users.length === 0 && (
              <AdminCard>
                <p className="text-muted text-sm text-center py-8">暂无用户</p>
              </AdminCard>
            )}
            {users.map((user) => (
              <AdminCard key={user.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-claude/15 flex items-center justify-center text-claude font-medium">
                    {user.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-ink font-medium text-sm">{user.name}</p>
                    <p className="text-muted text-xs">{user.username}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    user.role === 'admin'
                      ? 'bg-claude/10 text-claude border-claude/30'
                      : 'bg-ink/5 text-muted border-line'
                  }`}>
                  {user.role === 'admin' ? '管理员' : '用户'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(user)} className="text-xs text-muted hover:text-ink transition-colors">编辑</button>
                  <button onClick={() => setDeleteTarget(user)} className="text-xs text-muted hover:text-claude transition-colors">删除</button>
                </div>
              </AdminCard>
            ))}
          </div>

          <AdminModal open={!!modal} onClose={() => { setModal(null); setForm(emptyForm) }} title={modal?.mode === 'add' ? '添加用户' : '编辑用户'}>
            <div className="space-y-4">
              <AdminInput label="用户名" value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} />
              <AdminInput label="显示名称" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
              <AdminInput label={modal?.mode === 'edit' ? '新密码（留空不修改）' : '密码'} type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} />
              <div>
                <label className="block text-sm text-muted mb-1.5">角色</label>
                <select value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-lg border border-line bg-paper text-ink outline-none focus:border-claude/50">
                  <option value="user">用户</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              <AdminButton onClick={handleSave} className="w-full justify-center">
                {modal?.mode === 'add' ? '添加' : '保存'}
              </AdminButton>
            </div>
          </AdminModal>

          <AdminModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="确认删除">
            <p className="text-muted text-sm mb-6">确定要删除用户 <span className="text-ink">{deleteTarget?.name}</span> 吗?此操作不可撤销。</p>
            <div className="flex gap-3">
              <AdminButton variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1 justify-center">取消</AdminButton>
              <AdminButton variant="danger" onClick={handleDelete} className="flex-1 justify-center">删除</AdminButton>
            </div>
          </AdminModal>
        </main>
      </div>
    </div>
  )
}
