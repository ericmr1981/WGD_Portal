export default function AppCard({ app, onClick }) {
  const emoji = app.icon || '🔗'

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 p-3 rounded-lg border border-line bg-paper hover:bg-hover hover:border-claude/50 hover:shadow-sm transition-all group"
    >
      <span className="text-2xl group-hover:scale-110 transition-transform">
        {emoji}
      </span>
      <span className="text-xs text-ink truncate w-full text-left">
        {app.name}
      </span>
    </button>
  )
}
