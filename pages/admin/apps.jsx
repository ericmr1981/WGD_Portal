import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSession, isAdmin } from '../../src/lib/auth'
import AdminTopBar from '../../src/components/admin/AdminTopBar'
import AdminSideNav from '../../src/components/admin/AdminSideNav'
import AdminCard from '../../src/components/admin/AdminCard'
import AdminInput from '../../src/components/admin/AdminInput'
import AdminButton from '../../src/components/admin/AdminButton'
import AdminModal from '../../src/components/admin/AdminModal'
import { getApps, upsertApp, deleteApp, reorderApps, getConfig } from '../../src/lib/data'

const emptyForm = { name: '', url: '', icon: '', category: '', description: '', order: 1 }

const iconOptions = [
  { value: 'github', label: 'GitHub', emoji: '🐙' },
  { value: 'jira', label: 'Jira', emoji: '📋' },
  { value: 'slack', label: 'Slack', emoji: '💬' },
  { value: 'datadog', label: 'Datadog', emoji: '📈' },
  { value: 'custom', label: '自定义', emoji: '🔗' },
]

const sidebarItems = [
  { id: 'overview', label: '概览', icon: '📊' },
  { id: 'users', label: '用户管理', icon: '👥' },
  { id: 'apps', label: '应用管理', icon: '📦' },
  { id: 'prompts', label: '提示卡片', icon: '💬' },
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
    setConfigState(getConfig())
    loadApps()
  }, [])

  const loadApps = async () => {
    const result = await getApps()
    setApps(result)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) return

    if (modal.mode === 'add') {
      await upsertApp({ ...form, order: apps.length + 1 })
    } else {
      await upsertApp({ ...form, id: modal.app.id })
    }

    await loadApps()
    setModal(null)
    setForm(emptyForm)
  }

  const handleDelete = async () => {
    await deleteApp(deleteTarget.id)
    await loadApps()
    setDeleteTarget(null)
  }

  const openEdit = (app) => {
    setForm({ name: app.name, url: app.url, icon: app.icon, category: app.category, description: app.description, order: app.order })
    setModal({ mode: 'edit', app })
  }

  const handleDragStart = (id) => setDragId(id)
  const handleDragOver = (e) => e.preventDefault()

  const handleDrop = async (targetId) => {
    if (!dragId || dragId === targetId) return
    const ids = apps.map(a => a.id)
    const fromIdx = ids.indexOf(dragId)
    const toIdx = ids.indexOf(targetId)
    ids.splice(fromIdx, 1)
    ids.splice(toIdx, 0, dragId)
    await reorderApps(ids)
    await loadApps()
    setDragId(null)
  }

  const navigate = (id) => {
    if (id === 'overview') router.push('/admin')
    else if (id === 'users') router.push('/admin/users')
    else if (id === 'prompts') router.push('/admin/prompts')
  }

  if (!authorized) return null

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <AdminTopBar title="应用管理" />
      <div className="flex flex-1">
        <AdminSideNav
          active="apps"
          items={sidebarItems}
          onNavigate={navigate}
        />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-ink">应用列表</h2>
            <AdminButton onClick={() => { setForm(emptyForm); setModal({ mode: 'add' }) }}>
              + 添加应用
            </AdminButton>
          </div>

          <p className="text-muted text-xs mb-4">拖拽卡片可调整排序</p>

          <div className="space-y-3">
            {apps.length === 0 && (
              <AdminCard>
                <p className="text-muted text-sm text-center py-8">暂无应用</p>
              </AdminCard>
            )}
            {apps.map((app) => (
              <div
                key={app.id}
                draggable
                onDragStart={() => handleDragStart(app.id)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(app.id)}
                className={`transition-opacity ${dragId === app.id ? 'opacity-50' : ''}`}
              >
                <AdminCard className="flex items-center justify-between p-4 cursor-grab active:cursor-grabbing">
                  <div className="flex items-center gap-4">
                    <span className="text-muted text-sm cursor-move">⠿</span>
                    <div className="w-10 h-10 rounded-lg bg-paper border border-line flex items-center justify-center text-lg">
                      {app.icon ? iconOptions.find(o => o.value === app.icon)?.emoji || '🔗' : '🔗'}
                    </div>
                    <div className="flex flex-col">
                      <p className="text-ink font-medium text-sm">{app.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-ink/5 text-muted border border-line w-fit mt-1">
                        {app.category || '未分类'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(app)} className="text-xs text-muted hover:text-ink transition-colors">编辑</button>
                    <button onClick={() => setDeleteTarget(app)} className="text-xs text-muted hover:text-claude transition-colors">删除</button>
                  </div>
                </AdminCard>
              </div>
            ))}
          </div>

          <AdminModal open={!!modal} onClose={() => { setModal(null); setForm(emptyForm) }} title={modal?.mode === 'add' ? '添加应用' : '编辑应用'}>
            <div className="space-y-4">
              <AdminInput label="应用名称" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
              <AdminInput label="URL" value={form.url} onChange={(e) => setForm({...form, url: e.target.value})} placeholder="https://" />
              <AdminInput label="描述" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
              <div>
                <label className="block text-sm text-muted mb-1.5">图标</label>
                <select value={form.icon} onChange={(e) => setForm({...form, icon: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-lg border border-line bg-paper text-ink outline-none focus:border-claude/50">
                  {iconOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1.5">分类</label>
                <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-lg border border-line bg-paper text-ink outline-none focus:border-claude/50">
                  {config?.categories?.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <AdminButton onClick={handleSave} className="w-full justify-center">
                {modal?.mode === 'add' ? '添加' : '保存'}
              </AdminButton>
            </div>
          </AdminModal>

          <AdminModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="确认删除">
            <p className="text-muted text-sm mb-6">确定要删除应用 <span className="text-ink">{deleteTarget?.name}</span> 吗?</p>
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
