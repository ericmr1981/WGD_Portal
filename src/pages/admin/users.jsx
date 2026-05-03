import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSession, isAdmin, getUsers, addUser, updateUser, deleteUser, hashPassword } from '../../lib/auth'
import GlassNav from '../../components/GlassNav'
import AdminSidebar from '../../components/AdminSidebar'
import GlassCard from '../../components/GlassCard'
import GlassInput from '../../components/GlassInput'
import GlassButton from '../../components/GlassButton'
import Modal from '../../components/Modal'
import { generateId } from '../../lib/data'

const emptyForm = { username: '', password: '', name: '', role: 'user' }

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
    setUsers(getUsers())
  }, [])

  const refresh = () => setUsers([...getUsers()])

  const handleSave = async () => {
    if (!form.username.trim() || !form.name.trim()) return
    if (modal.mode === 'add' && !form.password.trim()) return
    if (modal.mode === 'add') {
      addUser({
        id: generateId(),
        username: form.username,
        password: await hashPassword(form.password),
        name: form.name,
        role: form.role,
        createdAt: new Date().toISOString().split('T')[0],
      })
    } else {
      const updates = {}
      if (form.password) updates.password = await hashPassword(form.password)
      updateUser(modal.user.id, { ...form, ...updates })
    }
    refresh()
    setModal(null)
    setForm(emptyForm)
  }

  const handleDelete = () => {
    deleteUser(deleteTarget.id)
    refresh()
    setDeleteTarget(null)
  }

  const openEdit = (user) => {
    setForm({ username: user.username, password: '', name: user.name, role: user.role })
    setModal({ mode: 'edit', user })
  }

  if (!authorized) return null

  return (
    <div className="min-h-screen flex flex-col">
      <GlassNav />
      <div className="flex flex-1">
        <AdminSidebar />
        <main className="flex-1 p-6 overflow-auto pb-20 sm:pb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">用户管理</h1>
            <GlassButton onClick={() => { setForm(emptyForm); setModal({ mode: 'add' }) }}>
              + 添加用户
            </GlassButton>
          </div>

          <div className="space-y-3">
            {users.map((user) => (
              <GlassCard key={user.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple
                                  flex items-center justify-center text-white font-medium">
                    {user.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{user.name}</p>
                    <p className="text-gray-500 text-xs">{user.username}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    user.role === 'admin'
                      ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20'
                      : 'bg-white/5 text-gray-400 border border-white/10'
                  }`}>
                    {user.role === 'admin' ? '管理员' : '员工'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(user)} className="text-xs text-gray-400 hover:text-white transition-colors">编辑</button>
                  <button onClick={() => setDeleteTarget(user)} className="text-xs text-red-400 hover:text-red-300 transition-colors">删除</button>
                </div>
              </GlassCard>
            ))}
          </div>

          <Modal open={!!modal} onClose={() => { setModal(null); setForm(emptyForm) }} title={modal?.mode === 'add' ? '添加用户' : '编辑用户'}>
            <div className="space-y-4">
              <GlassInput label="用户名" value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} />
              <GlassInput label="显示名称" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
              <GlassInput label={modal?.mode === 'edit' ? '新密码（留空不修改）' : '密码'} type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} />
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">角色</label>
                <select value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none">
                  <option value="user">员工</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              <GlassButton onClick={handleSave} className="w-full">
                {modal?.mode === 'add' ? '添加' : '保存'}
              </GlassButton>
            </div>
          </Modal>

          <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="确认删除">
            <p className="text-gray-400 text-sm mb-6">确定要删除用户 <span className="text-white">{deleteTarget?.name}</span> 吗？此操作不可撤销。</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 glass rounded-xl py-3 text-sm text-gray-300">取消</button>
              <button onClick={handleDelete} className="flex-1 bg-red-500/20 border border-red-500/30 rounded-xl py-3 text-sm text-red-400">删除</button>
            </div>
          </Modal>
        </main>
      </div>
    </div>
  )
}
