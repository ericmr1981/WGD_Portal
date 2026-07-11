import Link from 'next/link'

// 取首字符用于 chip 显示
// "蜜可诗管理后台" → "蜜"  "Roster App" → "R"
function firstChar(name = '') {
  const cleaned = String(name).replace(/(系统|后台|管理|看板)$/, '')
  const c = cleaned.trim().charAt(0)
  if (!c) return '·'
  return /[一-龥]/.test(c) ? c : c.toUpperCase()
}

export default function AppCard({ app, index = 0 }) {
  const ch = firstChar(app?.name)
  const href = app?.id ? `/launch/${app.id}` : '#'

  return (
    <Link
      href={href}
      style={{ animationDelay: `${index * 30}ms` }}
      className="group flex items-start gap-3 p-4 rounded-xl border border-line bg-paper
                 hover:bg-hover hover:border-claude/40 transition-colors animate-[fadeIn_0.25s_ease-out_both]"
    >
      <span className="shrink-0 w-9 h-9 rounded-lg bg-claude/15 text-claude text-base font-medium
                       flex items-center justify-center
                       group-hover:bg-claude/25 transition-colors">
        {ch}
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-ink truncate group-hover:text-claude transition-colors">
          {app?.name}
        </h3>
        {app?.description && (
          <p className="mt-0.5 text-xs text-muted line-clamp-2 leading-relaxed">
            {app.description}
          </p>
        )}
      </div>
    </Link>
  )
}