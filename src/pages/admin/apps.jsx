import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSession, isAdmin } from '../../lib/auth'
import GlassNav from '../../components/GlassNav'
import AdminSidebar from '../../components/AdminSidebar'
import GlassCard from '../../components/GlassCard'
import GlassInput from '../../components/GlassInput'
import GlassButton from '../../components/GlassButton'
import Modal from '../../components/Modal'
import { loadApps, addApp, updateApp, deleteApp, reorderApps, getConfig, generateId } from '../../lib/data'

const emptyForm = { name: '', url: '', icon: '', category: '', description: '', order: 1 }

const iconOptions = [
  { value: 'github', label: 'GitHub', color: 'from-blue-500 to-cyan-400' },
  { value: 'jira', label: 'Jira', color: 'from-neon-purple to-purple-400' },
  { value: 'slack', label: 'Slack', color: 'from-pink-500 to-rose-400' },
  { value: 'datadog', label: 'Datadog', color: 'from-amber-500 to-red-400' },
  { value: 'custom', label: '自定义', color: 'from-neon-cyan to-neon-purple' },
]

export default function AdminAppsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [apps, setApps] = useState([])
  const [config, setConfigState] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [dragId, setDragId] = useState(null)

  useEffect(() => {
    if (!getSession()) { router.replace('/login'); return }
    if (!isAdmin()) { router.replace('/'); return }
    setAuthorized(true)
    setApps(loadApps())
    setConfigState(getConfig())
  }, [])

  const refresh = () => setApps([...loadApps()])

  const handleSave = () => {
    if (modal.mode === 'add') {
      addApp({ id: generateId(), ...form, order: apps.length + 1 })
    } else {
      updateApp(modal.app.id, form)
    }
    refresh()
    setModal(null)
    setForm(emptyForm)
  }

  const handleDelete = () => {
    deleteApp(deleteTarget.id)
    refresh()
    setDeleteTarget(null)
  }

  const openEdit = (app) => {
    setForm({ name: app.name, url: app.url, icon: app.icon, category: app.category, description: app.description, order: app.order })
    setModal({ mode: 'edit', app })
  }

  const handleDragStart = (id) => setDragId(id)

  const handleDragOver = (e) => e.preventDefault()

  const handleDrop = (targetId) => {
    if (!dragId || dragId === targetId) return
    const ids = apps.map(a => a.id)
    const fromIdx = ids.indexOf(dragId)
    const toIdx = ids.indexOf(targetId)
    ids.splice(fromIdx, 1)
    ids.splice(toIdx, 0, dragId)
    reorderApps(ids)
    refresh()
    setDragId(null)
  }

  if (!authorized) return null

  return (
    <div className="min-h-screen flex flex-col">
      <GlassNav />
      <div className="flex flex-1">
        <AdminSidebar />
        <main className="flex-1 p-6 overflow-auto pb-20 sm:pb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">应用管理</h1>
            <GlassButton onClick={() => { setForm(emptyForm); setModal({ mode: 'add' }) }}>
              + 添加应用
            </GlassButton>
          </div>

          <p className="text-gray-500 text-xs mb-4">拖拽卡片可调整排序</p>

          <div className="space-y-3">
            {apps.map((app) => (
              <div
                key={app.id}
                draggable
                onDragStart={() => handleDragStart(app.id)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(app.id)}
                className={`transition-opacity ${dragId === app.id ? 'opacity-50' : ''}`}
              >
                <GlassCard className="flex items-center justify-between p-4 cursor-grab active:cursor-grabbing">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-600 text-sm cursor-move">⠿</span>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${
                      iconOptions.find(o => o.value === app.icon)?.color || iconOptions[4].color
                    } flex items-center justify-center text-white font-medium text-sm`}>
                      {app.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{app.name}</p>
                      <p className="text-gray-500 text-xs">{app.url}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
                      {app.category}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(app)} className="text-xs text-gray-400 hover:text-white transition-colors">编辑</button>
                    <button onClick={() => setDeleteTarget(app)} className="text-xs text-red-400 hover:text-red-300 transition-colors">删除</button>
                  </div>
                </GlassCard>
              </div>
            ))}
          </div>

          <Modal open={!!modal} onClose={() => { setModal(null); setForm(emptyForm) }} title={modal?.mode === 'add' ? '添加应用' : '编辑应用'}>
            <div className="space-y-4">
              <GlassInput label="应用名称" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
              <GlassInput label="URL" value={form.url} onChange={(e) => setForm({...form, url: e.target.value})} placeholder="https://" />
              <GlassInput label="描述" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">图标</label>
                <select value={form.icon} onChange={(e) => setForm({...form, icon: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none">
                  {iconOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">分类</label>
                <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none">
                  {config?.categories?.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <GlassButton onClick={handleSave} className="w-full">
                {modal?.mode === 'add' ? '添加' : '保存'}
              </GlassButton>
            </div>
          </Modal>

          <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="确认删除">
            <p className="text-gray-400 text-sm mb-6">确定要删除应用 <span className="text-white">{deleteTarget?.name}</span> 吗？</p>
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
