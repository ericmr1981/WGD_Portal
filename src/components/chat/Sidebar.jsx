import { useState } from 'react'
import FooterMenu from './FooterMenu'

export default function Sidebar({
  sessions,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  isAdmin,
  onOpenAdmin,
  currentUser,
  onLogout,
  mobileOpen,
  onClose,
}) {
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const commitRename = (id) => {
    const t = draft.trim()
    if (t) onRename(id, t)
    setEditingId(null)
    setDraft('')
  }

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-ink/40 z-30 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`
          w-[280px] h-screen min-h-0 bg-paper border-r border-line flex flex-col shrink-0 z-40
          fixed md:static
          transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
      <div className="p-3">
        <button
          onClick={onCreate}
          className="w-full text-left px-3 py-2 rounded-lg border border-line bg-paper hover:bg-hover text-ink text-sm"
        >
          + 新建
        </button>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto px-2 space-y-1">
        {sessions.length === 0 ? (
          <p className="text-muted text-sm px-3 py-6">还没有会话</p>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              className={`group relative rounded-lg px-3 py-2 cursor-pointer text-sm
                          ${s.id === activeId ? 'bg-hover text-ink' : 'text-ink hover:bg-hover'}`}
              onClick={() => editingId === s.id ? null : onSelect(s.id)}
            >
              {editingId === s.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(s.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="w-full bg-paper text-ink text-sm focus:outline-none"
                />
              ) : (
                <>
                  <div className="truncate">{s.title}</div>
                  {s.brand && <div className="text-muted text-xs mt-0.5">{s.brand}</div>}
                  <div className="hidden group-hover:flex absolute right-2 top-2 gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(s.id); setDraft(s.title) }}
                      className="text-muted hover:text-ink text-xs"
                      title="重命名"
                    >✎</button>
                    {confirmDeleteId === s.id ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(s.id); setConfirmDeleteId(null) }}
                        className="text-claude text-xs"
                      >确认删除</button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(s.id) }}
                        className="text-muted hover:text-claude text-xs"
                        title="删除"
                      >🗑</button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </nav>

      <div className="p-2 border-t border-line">
        <FooterMenu
          currentUser={currentUser}
          isAdmin={isAdmin}
          onOpenAdmin={onOpenAdmin}
          onLogout={onLogout}
        />
      </div>
    </aside>
    </>
  )
}
