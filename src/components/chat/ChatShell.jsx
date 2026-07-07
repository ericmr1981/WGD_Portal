import { useEffect, useState, useRef } from 'react'
import Sidebar from './Sidebar'
import MessageList from './MessageList'
import Composer from './Composer'
import EmptyState from './EmptyState'
import useAgentSocket from '../../lib/useAgentSocket'

let tempId = 0
const nextTempId = () => `t-${++tempId}`

export default function ChatShell({ currentUser, isAdmin }) {
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [streamingBuffer, setStreamingBuffer] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [failed, setFailed] = useState(false)
  const [connState, setConnState] = useState('connecting')
  const pendingRef = useRef(null)

  // load sessions
  useEffect(() => {
    fetch('/api/sessions', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setSessions(d)
          if (d[0]) setActiveId(d[0].id)
        }
      })
      .catch(() => {})
  }, [])

  // load messages when active changes
  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    fetch(`/api/sessions/${activeId}/messages`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setMessages(Array.isArray(d) ? d : []))
      .catch(() => setMessages([]))
  }, [activeId])

  // socket
  const { send } = useAgentSocket({
    onUpdate: (p) => setStreamingBuffer((b) => b + (p?.delta ?? '')),
    onDone: (p) => {
      setStreamingBuffer((b) => {
        const final = b + (p?.content ?? '')
        setMessages((m) => [...m, { role: 'assistant', content: final, status: 'done' }])
        return ''
      })
      setStreaming(false)
    },
    onError: () => {
      setStreaming(false)
      setFailed(true)
    },
    onConnectionChange: setConnState,
  })

  const sendMessage = ({ content, brand }) => {
    if (!activeId) {
      fetch('/api/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ brand }),
      })
        .then((r) => r.json())
        .then((s) => {
          if (s && s.id) {
            setSessions((arr) => [s, ...arr])
            setActiveId(s.id)
            pendingRef.current = { content, brand }
          }
        })
      return
    }
    setMessages((m) => [...m, { id: nextTempId(), role: 'user', content }])
    setStreaming(true)
    setFailed(false)
    setStreamingBuffer('')
    send({ conversationId: activeId, content, brand })
  }

  // pending: triggered when activeId becomes available after auto-create
  useEffect(() => {
    if (activeId && pendingRef.current) {
      const { content, brand } = pendingRef.current
      pendingRef.current = null
      setMessages((m) => [...m, { id: nextTempId(), role: 'user', content }])
      setStreaming(true)
      setStreamingBuffer('')
      send({ conversationId: activeId, content, brand })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  const onCreate = () =>
    fetch('/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((s) => {
        if (s && s.id) {
          setSessions((arr) => [s, ...arr])
          setActiveId(s.id)
        }
      })

  const onRename = (id, title) =>
    fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    }).then(() => setSessions((arr) => arr.map((s) => s.id === id ? { ...s, title } : s)))

  const onDelete = (id) =>
    fetch(`/api/sessions/${id}`, { method: 'DELETE', credentials: 'include' })
      .then(() => {
        setSessions((arr) => {
          const next = arr.filter((s) => s.id !== id)
          if (activeId === id) {
            const fallback = next[0]?.id ?? null
            setActiveId(fallback)
          }
          return next
        })
      })

  const onOpenAdmin = () => {
    window.location.href = '/admin'
  }

  return (
    <div className="chat-root min-h-screen flex">
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
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-line px-6 py-3 text-sm text-muted bg-paper">
          {connState === 'ok' ? '已连接' :
           connState === 'reconnecting' ? '重连中…' :
           connState === 'failed' ? '连接失败' : '连接中…'}
        </header>
        {messages.length === 0 && !streaming
          ? <EmptyState onPick={(c) => sendMessage({ content: c, brand: null })} />
          : <MessageList messages={messages} streamingBuffer={streamingBuffer} failed={failed} />
        }
        <Composer onSend={sendMessage} disabled={streaming} />
      </div>
    </div>
  )
}
