import { useState, useMemo } from 'react'
import FooterMenu from './FooterMenu'
import AppCard from './AppCard'

// Group label + session bucket
function groupSessions(sessions) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfWeek.getDate() - 6)

  const groups = [
    { label: '今天', items: [] },
    { label: '昨天', items: [] },
    { label: '本周', items: [] },
    { label: '更早', items: [] },
  ]
  for (const s of sessions) {
    const t = new Date(s.updated_at || 0)
    if (t >= startOfToday) groups[0].items.push(s)
    else if (t >= startOfYesterday) groups[1].items.push(s)
    else if (t >= startOfWeek) groups[2].items.push(s)
    else groups[3].items.push(s)
  }
  return groups.filter((g) => g.items.length > 0)
}

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
  apps = [],
  onOpenApp,
}) {
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [appsOpen, setAppsOpen] = useState(false)

  const commitRename = (id) => {
    const t = draft.trim()
    if (t) onRename(id, t)
    setEditingId(null)
    setDraft('')
  }

  const grouped = useMemo(() => groupSessions(sessions), [sessions])

  return (
    <>
      {/* Mobile + Tablet overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-ink/40 z-30 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`
          w-[280px] h-screen min-h-0 bg-paper border-r border-line flex flex-col shrink-0 z-40
          fixed lg:static
          transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand + new chat */}
        <div className="p-3 border-b border-line">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-7 h-7 rounded-lg bg-claude/10 flex items-center justify-center text-claude text-sm">✦</div>
            <div className="text-sm font-semibold text-ink">WGD Portal</div>
          </div>
          <button
            onClick={onCreate}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-line
                       bg-paper hover:bg-hover text-ink text-sm transition"
          >
            <span>+ 新建会话</span>
            <span className="text-muted text-xs">⌘N</span>
          </button>
        </div>

        {/* Session list — grouped by recency */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
          {sessions.length === 0 ? (
            <p className="text-muted text-sm px-3 py-6">还没有会话</p>
          ) : (
            <div className="space-y-3">
              {grouped.map((g) => (
                <div key={g.label}>
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted">
                    {g.label}
                  </div>
                  <div className="space-y-0.5">
                    {g.items.map((s) => {
                      const isActive = s.id === activeId
                      return (
                        <div
                          key={s.id}
                          className={`group relative rounded-lg px-3 py-2 cursor-pointer text-sm
                                      ${isActive ? 'bg-hover text-ink' : 'text-ink hover:bg-hover'}`}
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
                                  >确认</button>
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
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </nav>

        {/* Applications list — collapsible */}
        {apps.length > 0 && (
          <div className="p-3 border-t border-line space-y-2">
            <button
              onClick={() => setAppsOpen((v) => !v)}
              className="w-full flex items-center justify-between text-xs text-muted uppercase tracking-wide"
            >
              <span>应用 ({apps.length})</span>
              <span className={`text-xs transition-transform ${appsOpen ? 'rotate-90' : ''}`}>▸</span>
            </button>
            {appsOpen && (
              <div className="grid grid-cols-2 gap-2">
                {apps.slice(0, 4).map((app) => (
                  <AppCard
                    key={app.id}
                    app={app}
                    onClick={() => onOpenApp?.(app.url)}
                  />
                ))}
              </div>
            )}
            {appsOpen && apps.length > 4 && (
              <button
                onClick={() => onOpenAdmin?.()}
                className="w-full text-left px-3 py-2 rounded-lg border border-line bg-paper hover:bg-hover text-ink text-xs"
              >
                + 显示全部应用 ({apps.length})
              </button>
            )}
          </div>
        )}

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