export default function AdminCard({ children, title, subtitle, icon, onClick, className = '' }) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-paper border border-line rounded-xl p-5 shadow-sm
        ${onClick ? 'cursor-pointer hover:border-claude/50 hover:bg-hover transition-colors' : ''}
        ${className}
      `}
    >
      {title && (
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted text-xs uppercase tracking-wider mb-1">{title}</p>
            {subtitle && <p className="text-ink text-2xl font-semibold">{subtitle}</p>}
          </div>
          {icon && <span className="text-2xl">{icon}</span>}
        </div>
      )}
      {children}
    </div>
  )
}
