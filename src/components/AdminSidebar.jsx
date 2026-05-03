import { useRouter } from 'next/router'

const links = [
  { href: '/admin', label: '概览', icon: '📊' },
  { href: '/admin/users', label: '用户管理', icon: '👥' },
  { href: '/admin/apps', label: '应用管理', icon: '📦' },
]

export default function AdminSidebar() {
  const router = useRouter()

  return (
    <>
      <aside className="hidden sm:flex flex-col w-56 glass h-[calc(100vh-4rem)] border-r border-white/5 p-4 shrink-0">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">管理后台</p>
        <nav className="space-y-1">
          {links.map((link) => {
            const active = router.pathname === link.href
            return (
              <button
                key={link.href}
                onClick={() => router.push(link.href)}
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
      </aside>

      <nav className="sm:hidden flex glass border-t border-white/5">
        {links.map((link) => {
          const active = router.pathname === link.href
          return (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className={`flex-1 flex flex-col items-center py-3 text-xs transition-colors ${
                active ? 'text-neon-cyan' : 'text-gray-500'
              }`}
            >
              <span className="text-lg mb-0.5">{link.icon}</span>
              <span>{link.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
