// src/components/chat/MessageList.jsx
import { useEffect, useRef } from 'react'
import MarkdownView from './MarkdownView'

function AssistantAvatar() {
  return <div className="shrink-0 w-7 h-7 rounded-lg bg-claude/10 flex items-center justify-center text-claude text-sm mt-0.5">✦</div>
}

function AnimatedDots() {
  return (
    <span className="inline-flex gap-0.5 ml-1 align-middle">
      <span className="w-1 h-1 rounded-full bg-claude/60 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1 h-1 rounded-full bg-claude/60 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1 h-1 rounded-full bg-claude/60 animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  )
}

// Three-section layout — always shown while streaming
function StreamingSections({ progress, toolCount, textContent, isStreaming }) {
  return (
    <div className="border border-dashed border-claude/20 rounded-xl p-4 bg-claude/[0.02] space-y-3">
      {/* Section 1: progress label, always visible */}
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-claude/60 animate-pulse" />
        <span className="text-xs text-muted font-medium">{progress || 'Thinking'}</span>
        {isStreaming && <AnimatedDots />}
      </div>
      {/* Section 2: tool count, shown when > 0 */}
      {toolCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">🔧 调用工具</span>
          <span className="text-xs text-claude font-semibold tabular-nums">{toolCount} 次</span>
          {progress === 'Calling tool' && isStreaming && <AnimatedDots />}
        </div>
      )}
      {/* Section 3: accumulated text */}
      {textContent ? (
        <div className="text-sm text-ink leading-relaxed">
          <MarkdownView>{textContent}</MarkdownView>
        </div>
      ) : null}
    </div>
  )
}

// Collapsible tool group for completed messages
function groupToolBlocks(blocks) {
  const groups = []; let i = 0
  while (i < blocks.length) {
    const b = blocks[i]
    if (b.type === 'tool_use') {
      const group = { type: 'tool_group', tools: [] }
      while (i < blocks.length && (blocks[i].type === 'tool_use' || blocks[i].type === 'tool_result')) {
        group.tools.push(blocks[i]); i++
      }
      groups.push(group)
    } else { groups.push(b); i++ }
  }
  return groups
}

function ToolGroupView({ tools }) {
  return (
    <details className="mb-3 group">
      <summary className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-claude/30 bg-claude/5 text-xs text-muted cursor-pointer hover:bg-claude/10 list-none">
        <span>🔧</span><span>工具调用 ({tools.length} 步)</span>
        <span className="opacity-60 group-open:rotate-90 transition-transform ml-auto">▸</span>
      </summary>
      <div className="mt-2 pl-4 border-l-2 border-dashed border-claude/20 space-y-2">
        {tools.map((t, ti) => {
          if (t.type === 'tool_use') return (
            <div key={ti} className="text-xs">
              <div className="text-claude font-medium mb-1">{t.name || '工具调用'}</div>
              <pre className="bg-hover rounded-lg p-2 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap text-muted">
                {typeof t.input === 'string' ? t.input : JSON.stringify(t.input, null, 2)}
              </pre>
            </div>
          )
          if (t.type === 'tool_result') return (
            <div key={ti} className="text-xs">
              <div className="text-muted font-medium mb-1">结果{t.is_error ? ' (错误)' : ''}</div>
              <pre className="bg-hover rounded-lg p-2 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap text-muted">
                {typeof t.content === 'string' ? t.content : JSON.stringify(t.content, null, 2)}
              </pre>
            </div>
          )
          return null
        })}
      </div>
    </details>
  )
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

          if (isUser) {
            const text = (m.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
            return (
              <div key={m.id ?? i} className="flex justify-end">
                <div className="bg-hover text-ink rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[80%] text-sm whitespace-pre-wrap">
                  {text}{m.status === 'pending' && <span className="text-muted ml-1">…</span>}
                </div>
              </div>
            )
          }

          // Assistant: if streaming and last → three-section layout (accumulates across cycles)
          if (m.status === 'streaming' && isLast) {
            return (
              <div key={m.id ?? i} className="flex gap-3 items-start">
                <AssistantAvatar />
                <div className="flex-1 min-w-0">
                  <StreamingSections
                    progress={m.progress} toolCount={m.toolCount || 0}
                    textContent={m.textContent || ''} isStreaming={isStreaming}
                  />
                  {m.status === 'error' && <p className="mt-2 text-xs text-claude">⚠ 回复出错</p>}
                </div>
              </div>
            )
          }

          // Completed assistant message: use textContent for the full markdown + tool groups
          const textBlocks = (m.content || []).filter(b => b.type === 'text')
          const fullText = textBlocks.map(b => b.text).join('')
          const allText = fullText || m.textContent || ''
          const hasContent = allText.length > 0
          const toolBlocks = (m.content || []).filter(b => b.type === 'tool_use' || b.type === 'tool_result')
          const toolGroups = toolBlocks.length > 0 ? groupToolBlocks(toolBlocks) : []
          return (
            <div key={m.id ?? i} className="flex gap-3 items-start">
              <AssistantAvatar />
              <div className="flex-1 min-w-0 text-ink text-[15px] leading-7">
                {allText ? (
                  <div className="chat-markdown text-ink leading-relaxed">
                    <MarkdownView>{allText}</MarkdownView>
                  </div>
                ) : !m.progress ? (
                  <p className="text-sm text-muted italic">无回复内容</p>
                ) : null}
                {toolGroups.map((item, gi) =>
                  item.type === 'tool_group'
                    ? <ToolGroupView key={gi} tools={item.tools} />
                    : null
                )}
                {m.status === 'error' && <p className="mt-2 text-xs text-claude">⚠ 回复出错</p>}
                {m.status === 'interrupted' && <p className="mt-2 text-xs text-muted">⏹ 已停止</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
