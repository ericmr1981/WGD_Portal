import { useEffect, useRef } from 'react'
import MarkdownView from './MarkdownView'

export default function MessageList({ messages, streamingBuffer, failed }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, streamingBuffer])

  const showStreaming = streamingBuffer && messages[messages.length - 1]?.role !== 'user'

  return (
    <div ref={ref} className="flex-1 overflow-y-auto px-6 py-8 bg-paper">
      <div className="max-w-[720px] mx-auto space-y-6">
        {messages.map((m, i) => {
          const isUser = m.role === 'user'
          const isLast = i === messages.length - 1
          return (
            <div key={m.id ?? i} className={isUser ? 'flex justify-end' : 'flex justify-start'}>
              <div className={
                isUser
                  ? 'bg-ink text-paper rounded-2xl px-4 py-2.5 max-w-[80%] whitespace-pre-wrap'
                  : 'text-ink max-w-[100%]'
              }>
                {isUser ? (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                ) : (
                  <>
                    <MarkdownView>{m.content}</MarkdownView>
                    {isLast && failed && (
                      <p className="mt-2 text-xs text-claude">⚠ 回复中断</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
        {showStreaming && (
          <div className="flex justify-start">
            <div className="text-ink max-w-[100%]">
              <MarkdownView>{streamingBuffer}</MarkdownView>
              <span className="ml-1 inline-block animate-pulse text-claude">▍</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
