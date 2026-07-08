export default function AdminSideNav({ active = 'overview', items, onNavigate }) {
  return (
    <nav className="w-56 bg-paper border-r border-line flex-shrink-0">
      <div className="p-4">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">管理</h2>
      </div>
      <div className="space-y-1 px-3 pb-4">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate?.(item.id)}
            className={`
              w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3
              ${active === item.id
                ? 'bg-claude/10 text-claude'
                : 'text-ink hover:bg-hover'}
            `}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
