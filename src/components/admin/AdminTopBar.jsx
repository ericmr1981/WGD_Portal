export default function AdminTopBar({ title = '管理后台' }) {
  return (
    <header className="border-b border-line bg-paper px-6 py-4 flex items-center justify-between">
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      <div className="text-xs text-muted">Admin</div>
    </header>
  )
}
