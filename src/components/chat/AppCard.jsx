// 取首字符用于 chip 显示
// "蜜可诗管理后台" → "蜜"  "Roster App" → "R"
function firstChar(name = '') {
  const cleaned = String(name).replace(/(系统|后台|管理|看板)$/, '')
  const c = cleaned.trim().charAt(0)
  if (!c) return '·'
  // CJK 直接返回,ASCII 转大写
  return /[一-龥]/.test(c) ? c : c.toUpperCase()
}

export default function AppCard({ app, onClick }) {
  const ch = firstChar(app?.name)

  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center justify-center gap-1.5
                 p-2.5 rounded-lg border border-line bg-paper
                 hover:bg-hover hover:border-claude/40 transition-colors"
      title={app?.name}
    >
      <span className="w-7 h-7 rounded-full bg-claude/15 text-claude text-sm font-medium
                       flex items-center justify-center
                       group-hover:bg-claude/25 transition-colors">
        {ch}
      </span>
      <span className="text-[11px] text-ink truncate w-full text-center leading-tight">
        {app?.name}
      </span>
    </button>
  )
}