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
  const streamingMsgRef = useRef(null)

  const loadSessions = async () => {
    try {
      const r = await fetch('/api/sessions', { credentials: 'include' })
      if (!r.ok) return
      const d = await r.json()
      if (Array.isArray(d)) setSessions(d.map(normalizeSession))
    } catch {}
  }
  useEffect(() => { loadSessions() }, [])

  const loadApps = async () => {
    try {
      const r = await fetch('/api/apps', { credentials: 'include' })
      if (r.ok) { const d = await r.json(); setApps(Array.isArray(d) ? d : []) }
    } catch {}
  }
  useEffect(() => { loadApps() }, [])

  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    if (justCreatedRef.current) { justCreatedRef.current = false; return }
    (async () => {
      try {
        const r = await fetch(`/api/sessions/${activeId}/messages`, { credentials: 'include' })
        if (!r.ok) { setMessages([]); return }
        const d = await r.json()
        const list = Array.isArray(d) ? d : (d?.messages ?? [])
        setMessages(list.map((m) => ({
          id: m.messageId ?? m.id, role: m.role,
          content: normalizeContent(m.content),
          status: m.status || 'done', stop_reason: m.stop_reason ?? null, usage: m.usage ?? null,
          createdAt: m.createdAt ?? m.created_at,
        })))
      } catch { setMessages([]) }
    })()
  }, [activeId])

  const flush = () => {
    const s = streamingMsgRef.current
    if (!s) return
    setMessages((prev) => { const n = [...prev]; n[n.length - 1] = { ...s }; return n })
  }

  const onEvent = useCallback((event) => {
    const s = streamingMsgRef.current
    switch (event.type) {
      case 'ack': {
        const ackId = event.payload?.messageId
        if (ackId) {
          setMessages((prev) => {
            const idx = prev.findIndex(m => m.role === 'user' && m.status === 'pending')
            if (idx === -1) return prev
            const n = [...prev]; n[idx] = { ...n[idx], id: ackId, status: 'sent' }; return n
          })
        }
        break
      }
      case 'message_start': {
        const msg = event.payload?.message || event.payload
        if (!s) {
          streamingMsgRef.current = {
            id: msg.id, role: 'assistant', status: 'streaming',
            content: [], stop_reason: null, usage: null,
            progress: 'Intake', toolCount: 0, textContent: '',
          }
          setMessages((prev) => [...prev, streamingMsgRef.current])
        } else {
          s.id = msg.id; s.progress = 'Intake'
          flush()
        }
        setIsStreaming(true)
        break
      }
      case 'content_block_start': {
        if (!s) break
        const block = event.payload?.content_block
        if (!block) break
        s.progress =
          block.type === 'thinking' ? 'Thinking'
          : block.type === 'tool_use' ? 'Calling tool'
          : block.type === 'tool_result' ? 'Thinking'
          : block.type === 'text' ? 'Writing'
          : s.progress
        if (block.type === 'tool_use') s.toolCount = (s.toolCount || 0) + 1
        s.content = [...s.content, block]
        flush()
        break
      }
      case 'content_block_delta': {
        if (!s) break
        const { index, delta } = event.payload || {}
        if (delta == null || !s.content[index]) return
        const block = { ...s.content[index] }
        if (delta.type === 'text_delta') {
          block.text = (block.text || '') + delta.text
          s.textContent = (s.textContent || '') + delta.text
        } else if (delta.type === 'thinking_delta') {
          block.thinking = (block.thinking || '') + delta.thinking
        } else if (delta.type === 'input_json_delta') {
          const base = typeof block.input === 'string' ? block.input : (block.input && Object.keys(block.input).length > 0 ? JSON.stringify(block.input) : '')
          block.input = base + delta.partial_json
        }
        s.content[index] = block
        flush()
        break
      }
      case 'content_block_stop':
        break
      case 'message_delta': {
        if (!s) break
        const sr = event.payload?.delta?.stop_reason ?? s.stop_reason
        s.stop_reason = sr
        s.usage = event.payload?.usage ?? s.usage
        if (sr === 'tool_use') s.progress = 'Calling tool'
        flush()
        break
      }
      case 'message_stop': {
        if (!s) break
        if (s.stop_reason === 'tool_use') { s.progress = 'Calling tool'; flush(); return }
        s.status = 'done'; s.progress = undefined
        flush()
        streamingMsgRef.current = null
        setIsStreaming(false)
        break
      }
      case 'error': {
        streamingMsgRef.current = null; setIsStreaming(false)
        setMessages((prev) => {
          const n = [...prev]; const l = n[n.length - 1]
          if (l && l.status === 'streaming') n[n.length - 1] = { ...l, status: 'error', progress: undefined }
          else n.push({ id: crypto.randomUUID(), role: 'assistant', status: 'error', content: [{ type: 'text', text: `[${event.payload?.code || 'error'}] ${event.payload?.message || '未知错误'}` }], stop_reason: null, usage: null })
          return n
        })
        break
      }
      case 'interrupted': {
        streamingMsgRef.current = null; setIsStreaming(false)
        setMessages((prev) => { const n = [...prev]; const l = n[n.length - 1]; if (l) n[n.length - 1] = { ...l, status: 'interrupted', progress: undefined }; return n })
        break
      }
    }
  }, [])

  const { send } = useAgentSocket({
    onEvent,
    onConnectionChange: (state) => { setConnState(state); if (state === 'reconnecting' || state === 'failed') setIsStreaming(false) },
  })

  const sendMessage = async ({ content, attachments = [] }) => {
    const clientMsgId = crypto.randomUUID()
    setMessages((m) => [...m, { id: clientMsgId, role: 'user', content: [{ type: 'text', text: content }], status: 'pending', stop_reason: null, usage: null }])
    setIsStreaming(true)
    let convId = activeId
    if (!convId) {
      try {
        const r = await fetch('/api/sessions', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) })
        if (!r.ok) throw new Error('session_create_failed')
        const s = await r.json(); const norm = normalizeSession(s)
        convId = norm.id; setSessions((arr) => [norm, ...arr]); justCreatedRef.current = true; setActiveId(convId)
      } catch {
        setIsStreaming(false); setMessages((m) => m.map((msg) => msg.id === clientMsgId ? { ...msg, status: 'error' } : msg)); return
      }
    }
    send({ conversationId: convId, content: [{ type: 'text', text: content }], attachments: (attachments || []).map((a) => ({ type: 'file', file_id: a.uploadId, fileName: a.fileName, mimeType: a.mimeType, size: a.size })) })
  }

  const onCreate = async () => {
    const r = await fetch('/api/sessions', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) })
    if (!r.ok) return
    const s = await r.json(); const norm = normalizeSession(s)
    setSessions((arr) => [norm, ...arr]); setActiveId(norm.id)
  }

  const onRename = async (id, title) => {
    const r = await fetch(`/api/sessions/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title }) })
    if (!r.ok) return
    const d = await r.json().catch(() => null)
    setSessions((arr) => arr.map((s) => s.id === id ? { ...s, title: d?.title ?? title } : s))
  }

  const onDelete = async (id) => {
    const r = await fetch(`/api/sessions/${id}`, { method: 'DELETE', credentials: 'include' })
    if (!r.ok && r.status !== 204) return
    setSessions((arr) => { const n = arr.filter((s) => s.id !== id); if (activeId === id) setActiveId(n[0]?.id ?? null); return n })
  }

  const onOpenAdmin = () => { window.location.href = '/admin' }
  const onOpenApp = (url) => { window.open(url, '_blank', 'noopener,noreferrer') }

  return (
    <div className="chat-root h-screen overflow-hidden flex bg-paper">
      <Sidebar sessions={sessions} activeId={activeId} onSelect={(id) => { setActiveId(id); setMobileOpen(false) }} onCreate={onCreate} onRename={onRename} onDelete={onDelete} isAdmin={isAdmin} onOpenAdmin={onOpenAdmin} currentUser={currentUser} apps={apps} onOpenApp={onOpenApp} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onLogout={async () => { await fetch('/api/auth/dev-logout', { method: 'POST', credentials: 'include' }); window.location.href = '/login' }} />
      <div className="flex-1 min-h-0 h-full flex flex-col">
        {/* Mobile + Tablet header */}
        <header className="shrink-0 border-b border-line px-4 py-2.5 bg-paper flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setMobileOpen((v) => !v)} className="lg:hidden shrink-0 p-1 -ml-1 text-ink hover:bg-hover rounded" aria-label="Toggle menu">☰</button>
            <span className="text-xs text-muted truncate">
              <span className={`inline-block w-2 h-2 rounded-full mr-1.5 shrink-0 ${connState === 'ok' ? 'bg-green-500' : connState === 'reconnecting' ? 'bg-yellow-400' : connState === 'failed' ? 'bg-red-500' : 'bg-gray-400'}`} />
              <span className="hidden sm:inline">{connState === 'ok' ? '已连接' : connState === 'reconnecting' ? '重连中…' : connState === 'failed' ? '连接失败' : '连接中…'}</span>
            </span>
          </div>
          {!activeId && <span className="text-xs text-claude hidden sm:inline shrink-0">点「+ 新建」开始</span>}
        </header>
        {messages.length === 0 ? <EmptyState onPick={(c) => sendMessage({ content: c })} /> : <MessageList messages={messages} isStreaming={isStreaming} />}
        <Composer onSend={sendMessage} disabled={isStreaming || !activeId} />
      </div>
    </div>
  )
}
