import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { getSession } from '../../lib/auth'
import { getApps } from '../../lib/data'

export default function LaunchPage() {
  const router = useRouter()
  const { id } = router.query

  useEffect(() => {
    if (!router.isReady) return

    const session = getSession()
    if (!session) {
      router.replace('/login')
      return
    }

    getApps().then((apps) => {
      const app = apps.find(a => a.id === id)
      if (!app) {
        router.replace('/')
        return
      }
      window.location.replace(app.url)
    })
  }, [router.isReady, id])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-10 w-full max-w-sm text-center border border-neon-cyan/20 neon-glow">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-neon-cyan to-neon-purple animate-pulse" />
        <h1 className="text-lg font-bold text-white mb-2">验证通过，正在跳转...</h1>
      </div>
    </div>
  )
}
