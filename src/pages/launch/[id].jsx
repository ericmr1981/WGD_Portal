import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSession } from '../../lib/auth'
import { loadApps } from '../../lib/data'

export default function LaunchPage() {
  const router = useRouter()
  const { id } = router.query
  const [status, setStatus] = useState('verifying')

  useEffect(() => {
    if (!router.isReady) return

    const session = getSession()
    if (!session) {
      router.replace('/login')
      return
    }

    const apps = loadApps()
    const app = apps.find(a => a.id === id)

    if (!app) {
      setStatus('not_found')
      return
    }

    setStatus('redirecting')
    window.location.href = app.url
  }, [router.isReady, id])

  if (status === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-10 w-full max-w-sm border border-red-500/20 text-center">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-xl font-bold text-white mb-2">应用未找到</h1>
          <p className="text-gray-400 text-sm mb-6">该应用不存在或已被删除</p>
          <button onClick={() => router.back()} className="text-neon-cyan hover:underline text-sm">返回</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-10 w-full max-w-sm text-center border border-neon-cyan/20 neon-glow">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-neon-cyan to-neon-purple
                        animate-pulse" />
        <h1 className="text-lg font-bold text-white mb-2">正在打开应用...</h1>
        <p className="text-gray-500 text-sm">已在新标签页中打开</p>
      </div>
    </div>
  )
}
