import { useEffect, useState, useRef } from 'react'
import Sidebar from './Sidebar'
import MessageList from './MessageList'
import Composer from './Composer'
import EmptyState from './EmptyState'
import StepList from './StepList'
import useAgentSocket from '../../lib/useAgentSocket'

// Normalize agent session → sidebar shape
function normalizeSession(s) {
  return {
    id: s.conversationId ?? s.id,
    brand: s.brand ?? null,
    title: s.title ?? '新会话',
    updated_at: s.lastActiveAt ?? s.updated_at,
  }
}

export default function ChatShell({ currentUser, isAdmin }) {
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [streamingSteps, setStreamingSteps] = useState([])
  const [streaming, setStreaming] = useState(false)
  const [failed, setFailed] = useState(false)
  const [connState, setConnState] = useState('connecting')

  // load sessions
  const loadSessions = async () => {
    try {
      const r = await fetch('/api/sessions', { credentials: 'include' })
      if (!r.ok) return
      const d = await r.json()
      if (Array.isArray(d)) {
        setSessions(d.map(normalizeSession))
      }
    } catch {}
  }
  useEffect(() => { loadSessions() }, [])

  // load messages when active changes
  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    (async () => {
      try {
        const r = await fetch(`/api/sessions/${activeId}/messages`, { credentials: 'include' })
        if (!r.ok) { setMessages([]); return }
        const d = await r.json()
        setMessages(Array.isArray(d) ? d.map((m) => ({
          id: m.messageId ?? m.id,
          role: m.role,
          content: m.content,
          status: m.status,
          createdAt: m.createdAt ?? m.created_at,
        })) : [])
      } catch {
        setMessages([])
      }
    })()
  }, [activeId])

  // socket
  const { send } = useAgentSocket({
    onUpdate: (p) => {
      if (p?.kind === 'step' && p.step) {
        setStreamingSteps((arr) => [...arr, p.step])
      }
    },
    onDone: (p) => {
      const finalSteps = p?.steps ?? []
      const finalContent = p?.content ?? ''
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: finalContent,
          status: 'done',
          steps: finalSteps,
        },
      ])
      setStreamingSteps([])
      setStreaming(false)
    },
    onError: () => {
      setStreaming(false)
      setFailed(true)
    },
    onConnectionChange: setConnState,
  })

  const sendMessage = ({ content, brand }) => {
    if (!activeId) return
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: 'user', content }])
    setStreaming(true)
    setFailed(false)
    setStreamingSteps([])
    send({ conversationId: activeId, content, brand })
  }

  const onCreate = async () => {
    const r = await fetch('/api/sessions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!r.ok) return
    const s = await r.json()
    const norm = normalizeSession(s)
    setSessions((arr) => [norm, ...arr])
    setActiveId(norm.id)
  }

  const onRename = async (id, title) => {
    const r = await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    if (!r.ok) return
    const d = await r.json().catch(() => null)
    const newTitle = d?.title ?? title
    setSessions((arr) => arr.map((s) => s.id === id ? { ...s, title: newTitle } : s))
  }

  const onDelete = async (id) => {
    const r = await fetch(`/api/sessions/${id}`, { method: 'DELETE', credentials: 'include' })
    if (!r.ok && r.status !== 204) return
    setSessions((arr) => {
      const next = arr.filter((s) => s.id !== id)
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null)
      }
      return next
    })
  }

  const onOpenAdmin = () => { window.location.href = '/admin' }

  return (
    <div className="chat-root h-screen overflow-hidden flex bg-paper">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={onCreate}
        onRename={onRename}
        onDelete={onDelete}
        isAdmin={isAdmin}
        onOpenAdmin={onOpenAdmin}
      />
      <div className="flex-1 min-h-0 h-full flex flex-col">
        <header className="shrink-0 border-b border-line px-6 py-3 text-sm text-muted bg-paper flex items-center justify-between">
          <span>
            {connState === 'ok' ? '已连接' :
             connState === 'reconnecting' ? '重连中…' :
             connState === 'failed' ? '连接失败' : '连接中…'}
          </span>
          {!activeId && (
            <span className="text-xs text-claude">点 sidebar「+ 新建」开始</span>
          )}
        </header>
        {messages.length === 0 && !streaming
          ? <EmptyState onPick={(c) => sendMessage({ content: c, brand: null })} />
          : <MessageList messages={messages} streamingSteps={streamingSteps} streaming={streaming} failed={failed} />
        }
        <Composer onSend={sendMessage} disabled={streaming || !activeId} />
      </div>
    </div>
  )
}