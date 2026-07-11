export default function FooterMenu({ currentUser, isAdmin, onOpenAdmin, onLogout }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      {/* User info */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-claude/15 flex items-center justify-center text-xs text-claude font-medium">
          {currentUser?.name?.charAt(0) ?? 'U'}
        </div>
        <div>
          <div className="text-sm font-medium text-ink truncate">{currentUser?.name ?? '用户'}</div>
          <div className="text-[10px] text-muted">{isAdmin ? '管理员' : '普通用户'}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {isAdmin && (
          <button
            onClick={onOpenAdmin}
            className="px-2.5 py-1.5 text-xs text-muted hover:text-ink hover:bg-hover rounded-lg transition"
          >
            后台
          </button>
        )}
        <button
          onClick={onLogout}
          className="px-2.5 py-1.5 text-xs text-muted hover:text-claude hover:bg-hover rounded-lg transition"
        >
          退出
        </button>
      </div>
    </div>
  )
}
