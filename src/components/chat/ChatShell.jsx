// src/components/chat/ChatShell.jsx
import { useEffect, useState, useRef, useCallback } from 'react'
import Sidebar from './Sidebar'
import MessageList from './MessageList'
import Composer from './Composer'
import EmptyState from './EmptyState'
import useAgentSocket from '../../lib/useAgentSocket'

function normalizeSession(s) {
  return {
    id: s.conversationId ?? s.id,
    brand: s.brand ?? null,
    title: s.title ?? '新会话',
    updated_at: s.lastActiveAt ?? s.updated_at,
  }
}

// 兼容旧版字符串 content → ContentBlock[]
function normalizeContent(content) {
  if (Array.isArray(content)) return content
  if (typeof content === 'string' && content) return [{ type: 'text', text: content }]
  return []
}

export default function ChatShell({ currentUser, isAdmin }) {
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [apps, setApps] = useState([])
  const [connState, setConnState] = useState('connecting')
  const [isStreaming, setIsStreaming] = useState(false)
  const justCreatedRef = useRef(false)

  // load sessions
  const loadSessions = async () => {
    try {
      const r = await fetch('/api/sessions', { credentials: 'include' })
      if (!r.ok) return
      const d = await r.json()
      if (Array.isArray(d)) setSessions(d.map(normalizeSession))
    } catch {}
  }
  useEffect(() => { loadSessions() }, [])

  // load apps
  const loadApps = async () => {
    try {
      const r = await fetch('/api/apps', { credentials: 'include' })
      if (r.ok) {
        const d = await r.json()
        setApps(Array.isArray(d) ? d : [])
      }
    } catch {}
  }
  useEffect(() => { loadApps() }, [])

  // load messages when active changes
  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    if (justCreatedRef.current) {
      justCreatedRef.current = false
      return
    }
    (async () => {
      try {
        const r = await fetch(`/api/sessions/${activeId}/messages`, { credentials: 'include' })
        if (!r.ok) { setMessages([]); return }
        const d = await r.json()
        const list = Array.isArray(d) ? d : (d?.messages ?? [])
        setMessages(list.map((m) => ({
          id: m.messageId ?? m.id,
          role: m.role,
          content: normalizeContent(m.content),
          status: m.status || 'done',
          stop_reason: m.stop_reason ?? null,
          usage: m.usage ?? null,
          createdAt: m.createdAt ?? m.created_at,
        })))
      } catch { setMessages([]) }
    })()
  }, [activeId])

  // ── WS 事件处理 ──
  const onEvent = useCallback((event) => {
    switch (event.type) {
      case 'ack': {
        const ackId = event.payload?.messageId
        if (ackId) {
          setMessages((prev) => {
            const idx = prev.findIndex(m => m.role === 'user' && m.status === 'pending')
            if (idx === -1) return prev
            const next = [...prev]
            next[idx] = { ...next[idx], id: ackId, status: 'sent' }
            return next
          })
        }
        break
      }
      case 'message_start': {
        const msg = event.payload?.message || event.payload
        setIsStreaming(true)
        setMessages((prev) => [...prev, {
          id: msg.id,
          role: 'assistant',
          status: 'streaming',
          content: [],
          stop_reason: null,
          usage: null,
        }])
        break
      }
      case 'content_block_start': {
        const block = event.payload?.content_block
        if (!block) break
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (!last || last.role !== 'assistant') return next
          next[next.length - 1] = { ...last, content: [...last.content, block] }
          return next
        })
        break
      }
      case 'content_block_delta': {
        const { index, delta } = event.payload || {}
        if (delta == null) break
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (!last || last.role !== 'assistant') return next
          if (!last.content[index]) return next
          const blocks = [...last.content]
          const block = { ...blocks[index] }
          if (delta.type === 'text_delta') block.text = (block.text || '') + delta.text
          else if (delta.type === 'thinking_delta') block.thinking = (block.thinking || '') + delta.thinking
          else if (delta.type === 'input_json_delta') {
            const base = typeof block.input === 'string' ? block.input : (block.input && Object.keys(block.input).length > 0 ? JSON.stringify(block.input) : '')
            block.input = base + delta.partial_json
          }
          blocks[index] = block
          next[next.length - 1] = { ...last, content: blocks }
          return next
        })
        break
      }
      case 'content_block_stop':
        break
      case 'message_delta': {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (!last) return next
          next[next.length - 1] = {
            ...last,
            stop_reason: event.payload?.delta?.stop_reason ?? last.stop_reason,
            usage: event.payload?.usage ?? last.usage,
          }
          return next
        })
        break
      }
      case 'message_stop': {
        setIsStreaming(false)
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (!last) return next
          next[next.length - 1] = { ...last, status: 'done' }
          return next
        })
        break
      }
      case 'error': {
        setIsStreaming(false)
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.status === 'streaming') {
            next[next.length - 1] = {
              ...last,
              status: 'error',
              content: [...last.content, { type: 'text', text: `[${event.payload?.code || 'error'}] ${event.payload?.message || '未知错误'}` }],
            }
          } else {
            next.push({
              id: crypto.randomUUID(),
              role: 'assistant',
              status: 'error',
              content: [{ type: 'text', text: `[${event.payload?.code || 'error'}] ${event.payload?.message || '未知错误'}` }],
              stop_reason: null,
              usage: null,
            })
          }
          return next
        })
        break
      }
      case 'interrupted': {
        setIsStreaming(false)
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last) next[next.length - 1] = { ...last, status: 'interrupted' }
          return next
        })
        break
      }
      default:
        break
    }
  }, [])

  const { send } = useAgentSocket({
    onEvent,
    onConnectionChange: (state) => {
      setConnState(state)
      if (state === 'reconnecting' || state === 'failed') setIsStreaming(false)
    },
  })

  const sendMessage = async ({ content, brand, attachments = [] }) => {
    const clientMsgId = crypto.randomUUID()
    setMessages((m) => [...m, {
      id: clientMsgId,
      role: 'user',
      content: [{ type: 'text', text: content }],
      status: 'pending',
      stop_reason: null,
      usage: null,
    }])
    setIsStreaming(true)

    let convId = activeId
    if (!convId) {
      try {
        const r = await fetch('/api/sessions', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (!r.ok) throw new Error('session_create_failed')
        const s = await r.json()
        const norm = normalizeSession(s)
        convId = norm.id
        setSessions((arr) => [norm, ...arr])
        justCreatedRef.current = true
        setActiveId(convId)
      } catch {
        setIsStreaming(false)
        setMessages((m) => m.map((msg) =>
          msg.id === clientMsgId ? { ...msg, status: 'error' } : msg
        ))
        return
      }
    }

    send({
      conversationId: convId,
      content,
      brand: brand || null,
      attachments: (attachments || []).map((a) => ({
        type: 'file',
        uploadId: a.uploadId,
        fileName: a.fileName,
        mimeType: a.mimeType,
        size: a.size,
      })),
    })
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
      if (activeId === id) setActiveId(next[0]?.id ?? null)
      return next
    })
  }

  const onOpenAdmin = () => { window.location.href = '/admin' }
  const onOpenApp = (url) => { window.open(url, '_blank', 'noopener,noreferrer') }

  const hasMessages = messages.length > 0

  return (
    <div className="chat-root h-screen overflow-hidden flex bg-paper">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={(id) => { setActiveId(id); setMobileOpen(false) }}
        onCreate={onCreate}
        onRename={onRename}
        onDelete={onDelete}
        isAdmin={isAdmin}
        onOpenAdmin={onOpenAdmin}
        currentUser={currentUser}
        apps={apps}
        onOpenApp={onOpenApp}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogout={async () => {
          await fetch('/api/auth/dev-logout', { method: 'POST', credentials: 'include' })
          window.location.href = '/login'
        }}
      />
      <div className="flex-1 min-h-0 h-full flex flex-col">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden p-3 -ml-3 text-ink hover:bg-hover -mr-3"
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <header className="shrink-0 border-b border-line px-6 py-3 text-sm text-muted bg-paper flex items-center justify-between">
          <span>
            {connState === 'ok' ? '已连接' :
             connState === 'reconnecting' ? '重连中…' :
             connState === 'failed' ? '连接失败' : '连接中…'}
          </span>
          {!activeId && <span className="text-xs text-claude">点 sidebar「+ 新建」开始</span>}
        </header>
        {!hasMessages
          ? <EmptyState onPick={(c) => sendMessage({ content: c, brand: null })} />
          : <MessageList messages={messages} isStreaming={isStreaming} />
        }
        <Composer onSend={sendMessage} disabled={isStreaming || !activeId} />
      </div>
    </div>
  )
}
