import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import ChatShell from '../components/chat/ChatShell'

export default function ChatPage() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/agent-token', { credentials: 'include' })
      .then((r) => {
        if (r.status === 401) { router.replace('/login'); return null }
        return r.json()
      })
      .then((d) => {
        if (!d) return
        const sub = parseJwtSub(d.token)
        if (!sub) { router.replace('/login'); return }
        setUser({ id: sub })
        setReady(true)
      })
      .catch(() => router.replace('/login'))
  }, [router])

  if (!ready || !user) {
    return (
      <div className="chat-root min-h-screen flex items-center justify-center text-muted text-sm">
        加载中…
      </div>
    )
  }

  return <ChatShell currentUser={user} isAdmin={isAdmin} />
}

function parseJwtSub(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.sub
  } catch {
    return null
  }
}
