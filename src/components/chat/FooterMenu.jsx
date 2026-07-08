import { useState, useEffect, useRef } from 'react'

export default function FooterMenu({ currentUser, isAdmin, onOpenAdmin, onLogout }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={menuRef} className="relative">
      {/* Footer trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-3 py-2 rounded-lg hover:bg-hover flex items-center gap-2 text-sm text-ink group"
      >
        <div className="w-8 h-8 rounded-full bg-claude/20 flex items-center justify-center text-xs text-claude font-medium">
          {currentUser?.name?.charAt(0) ?? 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate text-ink">{currentUser?.name ?? '用户'}</div>
          <div className="text-[10px] text-muted truncate">
            {isAdmin ? '管理员' : '普通用户'}
          </div>
        </div>
        <span className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}>
          ⌃
        </span>
      </button>

      {/* Dropdown panel - opens ABOVE the footer (bottom-anchored) */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2
                        bg-paper border border-line rounded-xl shadow-lg overflow-hidden
                        text-sm">
          {/* User header */}
          <div className="p-3 border-b border-line">
            <div className="font-medium text-ink truncate">{currentUser?.name ?? '未登录'}</div>
            <div className="text-xs text-muted truncate">
              {currentUser?.username ?? currentUser?.id ?? ''}
            </div>
          </div>

          {/* Apps list */}
          <div className="p-1.5">
            <div className="text-[10px] uppercase text-muted px-2 py-1">应用</div>
            <a
              href="/admin"
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-hover cursor-pointer"
            >
              <span className="w-7 h-7 rounded-md bg-ink/5 flex items-center justify-center text-base">📊</span>
              <div className="flex-1 min-w-0">
                <div className="text-ink">管理后台</div>
                <div className="text-[10px] text-muted truncate">数据总览</div>
              </div>
            </a>
            <a
              href="/chat"
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-hover"
            >
              <span className="w-7 h-7 rounded-md bg-ink/5 flex items-center justify-center text-base">💬</span>
              <div className="flex-1 min-w-0">
                <div className="text-ink">AI 对话</div>
                <div className="text-[10px] text-muted truncate">Agent Chat</div>
              </div>
            </a>
          </div>

          {/* Settings */}
          <div className="p-1.5 border-t border-line">
            <a
              href="/admin/apps"
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-hover"
            >
              <span className="w-7 h-7 rounded-md bg-ink/5 flex items-center justify-center text-base">⚙️</span>
              <div className="flex-1 min-w-0">
                <div className="text-ink">配置</div>
                <div className="text-[10px] text-muted truncate">应用与用户管理</div>
              </div>
            </a>
          </div>

          {/* Logout */}
          <div className="p-1.5 border-t border-line">
            <button
              onClick={() => { onLogout?.(); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-hover text-left"
            >
              <span className="w-7 h-7 rounded-md bg-ink/5 flex items-center justify-center text-base">→</span>
              <div className="flex-1 min-w-0">
                <div className="text-ink">退出登录</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}