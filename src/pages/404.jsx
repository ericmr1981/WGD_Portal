import Link from 'next/link'

export default function Custom404() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-10 w-full max-w-sm border border-neon-cyan/20 neon-glow text-center">
        <div className="text-6xl font-bold text-gradient mb-4">404</div>
        <p className="text-gray-400 mb-6">页面未找到</p>
        <Link href="/" className="inline-block bg-gradient-to-r from-neon-cyan to-neon-purple
               rounded-xl px-6 py-3 text-white font-semibold hover:shadow-[0_4px_20px_rgba(0,212,255,0.3)]
               transition-all duration-300">
          返回首页
        </Link>
      </div>
    </div>
  )
}
