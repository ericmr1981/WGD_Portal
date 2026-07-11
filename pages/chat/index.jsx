import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSession } from '../../src/lib/auth'
// 阶段 1:切到新协议 ChatShell。旧版 src/components/chat/ChatShell.jsx 保留,
// 等联调通过后再彻底清理(详见 spec-chat-portal.md §B + alignment-and-checklist.md §4)。
import ChatShell from '../../src/components/chat/ChatShell.tsx'

export default function ChatPage() {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()

  useEffect(() => {
    try {
      // 先读 localStorage 中的用户会话信息
      const s = getSession()
      const userFromSession = s ? { id: s.id, role: s.role } : null
      // 然后通过 /api/agent-token 验证 token 是否有效
      fetch('/api/agent-token', { credentials: 'include' })
        .then((r) => {
          if (r.status === 401) {
            // cookie 过期或不存在,但 localStorage 可能还有
            if (userFromSession) {
              setUser({ id: userFromSession.id })
              setIsAdmin(userFromSession.role === 'admin')
              setReady(true)
            } else {
              router.replace('/login')
            }
            return null
          }
          return r.json()
        })
        .then((d) => {
          if (!d) return
          const sub = parseJwtSub(d.token)
          if (!sub) {
            if (userFromSession) {
              setUser({ id: userFromSession.id })
              setIsAdmin(userFromSession.role === 'admin')
              setReady(true)
            } else {
              router.replace('/login')
            }
            return
          }
          // 使用 localStorage 中的完整信息
          setUser({ id: userFromSession?.id || sub })
          setIsAdmin(userFromSession?.role === 'admin' || false)
          setReady(true)
        })
        .catch(() => {
          if (userFromSession) {
            setUser({ id: userFromSession.id })
            setIsAdmin(userFromSession.role === 'admin')
            setReady(true)
          } else {
            router.replace('/login')
          }
        })
    } catch {
      router.replace('/login')
    }
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