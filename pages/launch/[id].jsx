import { useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { getSession } from '../../src/lib/auth'
import { getApps } from '../../src/lib/data'

export default function LaunchPage() {
  const router = useRouter()
  const { id } = router.query
  const popupRef = useRef(null)

  useEffect(() => {
    if (!router.isReady) return

    const session = getSession()
    if (!session) {
      router.replace('/login')
      return
    }

    // Open blank window before async to avoid popup blocker
    popupRef.current = window.open('', '_blank')

    getApps().then((apps) => {
      const app = apps.find(a => a.id === id)
      if (!app) {
        if (popupRef.current) popupRef.current.close()
        router.replace('/')
        return
      }
      if (popupRef.current) {
        popupRef.current.location.href = '/go/' + id
      } else {
        // Fallback: navigate in same tab if popup was blocked
        router.replace('/go/' + id)
        return
      }
      router.replace('/')
    })
  }, [router.isReady, id])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-10 w-full max-w-sm text-center border border-neon-cyan/20 neon-glow">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-neon-cyan to-neon-purple animate-pulse" />
        <h1 className="text-lg font-bold text-white mb-2">正在打开应用...</h1>
      </div>
    </div>
  )
}
