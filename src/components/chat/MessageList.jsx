// src/components/chat/MessageList.jsx
import { useEffect, useRef } from 'react'
import MarkdownView from './MarkdownView'

function AssistantAvatar() {
  return (
    <div className="shrink-0 w-7 h-7 rounded-lg bg-claude/10 flex items-center justify-center text-claude text-sm mt-0.5">
      ✦
    </div>
  )
}

function StreamingCursor() {
  return (
    <span className="inline-block w-1.5 h-4 ml-0.5 bg-claude/70 align-text-bottom animate-pulse" style={{ verticalAlign: '-2px' }} />
  )
}

function ContentBlockView({ block }) {
  switch (block.type) {
    case 'text':
      return (
        <div className="chat-markdown text-ink leading-relaxed">
          <MarkdownView>{block.text || ''}</MarkdownView>
        </div>
      )
    case 'thinking':
      return (
        <details className="mb-2 group">
          <summary className="inline-flex items-center gap-1.5 text-xs text-muted cursor-pointer hover:text-ink list-none">
            <span className="w-1.5 h-1.5 rounded-full bg-claude/60" />
            <span>思考过程</span>
            <span className="opacity-60 group-open:rotate-90 transition-transform">▸</span>
          </summary>
          <div className="mt-2 pl-3 border-l-2 border-claude/20 text-xs text-muted italic leading-relaxed whitespace-pre-wrap">
            {block.thinking || ''}
          </div>
        </details>
      )
    case 'tool_use':
      return (
        <details className="mb-2 group">
          <summary className="inline-flex items-center gap-1.5 text-xs text-claude cursor-pointer hover:underline list-none">
            <span>🔧</span>
            <span className="font-medium">{block.name || '工具调用'}</span>
          </summary>
          <div className="mt-1.5 pl-6 text-xs text-muted">
            <pre className="bg-hover rounded-lg p-2 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap">
              {typeof block.input === 'string' ? block.input : JSON.stringify(block.input, null, 2)}
            </pre>
          </div>
        </details>
      )
    case 'tool_result':
      return (
        <details className="mb-2 group">
          <summary className="inline-flex items-center gap-1.5 text-xs text-muted cursor-pointer hover:text-ink list-none">
            <span>📋</span>
            <span>工具结果{block.is_error ? ' (错误)' : ''}</span>
            <span className="opacity-60 group-open:rotate-90 transition-transform">▸</span>
          </summary>
          <div className="mt-1.5 pl-6 text-xs text-muted">
            <pre className="bg-hover rounded-lg p-2 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap">
              {typeof block.content === 'string' ? block.content : JSON.stringify(block.content, null, 2)}
            </pre>
          </div>
        </details>
      )
    default:
      return null
  }
}

export default function MessageList({ messages, isStreaming = false }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, isStreaming])

  return (
    <div ref={ref} className="flex-1 min-h-0 overflow-y-auto px-6 py-8 bg-paper">
      <div className="max-w-[720px] mx-auto space-y-6">
        {messages.map((m, i) => {
          const isUser = m.role === 'user'
          const isLast = i === messages.length - 1
          const isStreamingAssistant = !isUser && m.status === 'streaming' && isLast

          if (isUser) {
            const textBlocks = (m.content || []).filter(b => b.type === 'text')
            const text = textBlocks.map(b => b.text).join('')
            return (
              <div key={m.id ?? i} className="flex justify-end">
                <div className="bg-hover text-ink rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[80%] text-sm whitespace-pre-wrap">
                  {text}
                  {m.status === 'pending' && <span className="text-muted ml-1">…</span>}
                </div>
              </div>
            )
          }

          // assistant message
          const hasContent = (m.content || []).length > 0
          return (
            <div key={m.id ?? i} className="flex gap-3 items-start">
              <AssistantAvatar />
              <div className="flex-1 min-w-0 text-ink text-[15px] leading-7">
                {hasContent ? (
                  (m.content || []).map((block, bi) => (
                    <ContentBlockView key={bi} block={block} />
                  ))
                ) : (
                  isStreamingAssistant ? (
                    <p className="text-sm text-muted italic">
                      <StreamingCursor />
                    </p>
                  ) : (
                    <p className="text-sm text-muted italic">无回复内容</p>
                  )
                )}
                {isStreamingAssistant && hasContent && <StreamingCursor />}
                {m.status === 'error' && (
                  <p className="mt-2 text-xs text-claude">⚠ 回复出错</p>
                )}
                {m.status === 'interrupted' && (
                  <p className="mt-2 text-xs text-muted">⏹ 已停止</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
