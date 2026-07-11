import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSession, isAdmin } from '../../src/lib/auth'
import AdminTopBar from '../../src/components/admin/AdminTopBar'
import AdminSideNav from '../../src/components/admin/AdminSideNav'
import AdminCard from '../../src/components/admin/AdminCard'
import AdminInput from '../../src/components/admin/AdminInput'
import AdminButton from '../../src/components/admin/AdminButton'
import AdminModal from '../../src/components/admin/AdminModal'
import { adminGetPrompts, adminUpsertPrompt, adminDeletePrompt } from '../../src/lib/data'

const emptyForm = { icon: '📊', title: '', desc: '', prompt: '' }

const sidebarItems = [
  { id: 'overview', label: '概览', icon: '📊' },
  { id: 'users', label: '用户管理', icon: '👥' },
  { id: 'apps', label: '应用管理', icon: '📦' },
  { id: 'prompts', label: '提示卡片', icon: '💬' },
]

const iconOptions = ['📊', '⚠️', '💰', '📈', '🔔', '📋', '🎯', '🏷️', '📝', '🔍', '⚡', '🌟']

export default function AdminPromptsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [prompts, setPrompts] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    if (!getSession()) { router.replace('/login'); return }
    if (!isAdmin()) { router.replace('/'); return }
    setAuthorized(true)
    loadPrompts()
  }, [])

  const loadPrompts = async () => {
    const result = await adminGetPrompts()
    setPrompts(result)
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.prompt.trim()) return
    if (modal.mode === 'edit') {
      await adminUpsertPrompt({ ...form, id: modal.prompt.id })
    } else {
      await adminUpsertPrompt(form)
    }
    await loadPrompts()
    setModal(null)
    setForm(emptyForm)
  }

  const handleDelete = async () => {
    await adminDeletePrompt(deleteTarget.id)
    await loadPrompts()
    setDeleteTarget(null)
  }

  const openEdit = (p) => {
    setForm({ icon: p.icon, title: p.title, desc: p.desc, prompt: p.prompt })
    setModal({ mode: 'edit', prompt: p })
  }

  const navigate = (id) => {
    if (id === 'overview') router.push('/admin')
    else if (id === 'users') router.push('/admin/users')
    else if (id === 'apps') router.push('/admin/apps')
  }

  if (!authorized) return null

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <AdminTopBar title="提示卡片" />
      <div className="flex flex-1">
        <AdminSideNav active="prompts" items={sidebarItems} onNavigate={navigate} />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-ink">提示卡片列表</h2>
            <AdminButton onClick={() => { setForm(emptyForm); setModal({ mode: 'add' }) }}>
              + 添加卡片
            </AdminButton>
          </div>
          <p className="text-muted text-xs mb-4">聊天页面空状态显示的提示卡片</p>

          <div className="space-y-3">
            {prompts.length === 0 && (
              <AdminCard><p className="text-muted text-sm text-center py-8">暂无卡片</p></AdminCard>
            )}
            {prompts.map((p) => (
              <AdminCard key={p.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <span className="text-2xl">{p.icon || '📊'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-ink font-medium text-sm">{p.title}</p>
                    <p className="text-muted text-xs truncate">{p.desc}</p>
                    <p className="text-muted text-xs truncate mt-0.5 italic">{p.prompt}</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(p)} className="text-xs text-muted hover:text-ink transition-colors">编辑</button>
                  <button onClick={() => setDeleteTarget(p)} className="text-xs text-muted hover:text-claude transition-colors">删除</button>
                </div>
              </AdminCard>
            ))}
          </div>

          <AdminModal open={!!modal} onClose={() => { setModal(null); setForm(emptyForm) }} title={modal?.mode === 'add' ? '添加卡片' : '编辑卡片'}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-1.5">图标</label>
                <div className="flex flex-wrap gap-1.5">
                  {iconOptions.map((ico) => (
                    <button
                      key={ico}
                      type="button"
                      onClick={() => setForm({ ...form, icon: ico })}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition
                        ${form.icon === ico ? 'border-claude bg-claude/10' : 'border-line hover:border-claude/30'}`}
                    >{ico}</button>
                  ))}
                </div>
              </div>
              <AdminInput label="标题" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} placeholder="如: 业绩速览" />
              <AdminInput label="描述" value={form.desc} onChange={(e) => setForm({...form, desc: e.target.value})} placeholder="如: 本月各品牌营收对比" />
              <AdminInput label="Prompt" value={form.prompt} onChange={(e) => setForm({...form, prompt: e.target.value})} placeholder="发送给Agent的完整消息" />
              <AdminButton onClick={handleSave} className="w-full justify-center">
                {modal?.mode === 'add' ? '添加' : '保存'}
              </AdminButton>
            </div>
          </AdminModal>

          <AdminModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="确认删除">
            <p className="text-muted text-sm mb-6">确定要删除卡片 <span className="text-ink">{deleteTarget?.title}</span> 吗?</p>
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
