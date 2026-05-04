import { useRouter } from 'next/router'

const links = [
  { href: '/admin', label: '概览', icon: '📊' },
  { href: '/admin/users', label: '用户管理', icon: '👥' },
  { href: '/admin/apps', label: '应用管理', icon: '📦' },
]

export default function AdminSidebar({ mobileOpen, onClose }) {
  const router = useRouter()

  const NavItems = () => (
    <>
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-4 hidden sm:block">管理后台</p>
      <nav className="space-y-1">
        {links.map((link) => {
          const active = router.pathname === link.href
          return (
            <button
              key={link.href}
              onClick={() => { router.push(link.href); onClose?.() }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${
                active
                  ? 'bg-gradient-to-r from-neon-cyan/10 to-neon-purple/10 text-white border border-neon-cyan/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex flex-col w-56 glass h-[calc(100vh-4rem)] border-r border-white/5 p-4 shrink-0">
        <NavItems />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <aside className="relative w-64 h-full glass border-r border-white/5 p-4 pt-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <span className="text-white font-bold">导航</span>
              <button onClick={onClose} className="text-gray-400 text-xl">&times;</button>
            </div>
            <NavItems />
          </aside>
        </div>
      )}
    </>
  )
}
