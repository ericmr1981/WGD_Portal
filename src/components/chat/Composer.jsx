import { useState, useRef, useEffect } from 'react'

/**
 * 截断输入内容（防 token 溢出），同步版本。
 * 被 Composer 的 handleSend 调用。
 */
function clampInput(content) {
  if (!content) return ''
  const MAX_CHARS = 8000
  if (content.length <= MAX_CHARS) return content
  return content.slice(0, MAX_CHARS) + '\n…(截断)'
}

// 单个附件 chip — 显示文件名 + 大小
function AttachmentChip({ file, onRemove }) {
  return (
    <button
      onClick={() => onRemove(file.uploadId)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-hover border border-line
                 text-ink text-xs rounded-md hover:border-claude/40 transition"
      title="移除附件"
    >
      <span>📎</span>
      <span className="max-w-[160px] truncate">{file.fileName}</span>
      <span className="text-muted">{file.sizeLabel}</span>
      <span className="text-muted">×</span>
    </button>
  )
}

// Auto-resize textarea height between [min, max]
function autoResize(el, min = 36, max = 200) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(Math.max(el.scrollHeight, min), max) + 'px'
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // result is "data:<mime>;base64,<data>"
      const result = reader.result
      const idx = String(result).indexOf(',')
      resolve(idx >= 0 ? String(result).slice(idx + 1) : String(result))
    }
    reader.onerror = () => reject(new Error('read_failed'))
    reader.readAsDataURL(file)
  })
}

const MAX_INLINE_BYTES = 1 * 1024 * 1024 // 1 MB — base64 后 ~1.4 MB,WS 安全

export default function Composer({ onSend, disabled }) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState([])
  const [oversize, setOversize] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  // Auto-resize on text change
  useEffect(() => {
    autoResize(textareaRef.current)
  }, [text])

  const handleFilePick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    if (file.size > MAX_INLINE_BYTES) {
      setError(`文件过大 (${formatSize(file.size)}),最大支持 ${formatSize(MAX_INLINE_BYTES)}`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setAttachments((arr) => [
      ...arr,
      {
        file, // 真实 File 对象
        uploadId: crypto.randomUUID(),
        fileName: file.name,
        size: file.size,
        sizeLabel: formatSize(file.size),
        mimeType: file.type || 'application/octet-stream',
      },
    ])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemove = (uploadId) => {
    setAttachments((arr) => arr.filter((a) => a.uploadId !== uploadId))
  }

  const submit = async () => {
    const t = text.trim()
    if (!t && attachments.length === 0) return
    setError('')

    // 把附件内联到 content 末尾(每个一段)
    const inlineParts = []
    for (const a of attachments) {
      try {
        const b64 = await fileToBase64(a.file)
        inlineParts.push(
          `\n\n[附件: ${a.fileName} | ${a.mimeType} | ${a.sizeLabel}]\ndata:attachment;base64,${b64}`
        )
      } catch {
        setError(`读取文件失败: ${a.fileName}`)
        return
      }
    }
    const finalContent = t + inlineParts.join('')
    const { text: finalText, oversize } = finalContent.length > 8000
      ? { text: finalContent.slice(0, 8000) + '\n…(截断)', oversize: true }
      : { text: finalContent, oversize: false }
    setOversize(oversize)

    // attachments 字段仍然保留 uploadId 引用(未来 agent 支持了可以直接 fetch)
    // 但当前对 agent 来说,文件内容已经在 content 里
    onSend({
      content: finalText,
      attachments: attachments.map((a) => ({
        type: 'file',
        uploadId: a.uploadId,
        fileName: a.fileName,
        mimeType: a.mimeType,
        size: a.size,
      })),
    })
    setText('')
    setAttachments([])
    setTimeout(() => autoResize(textareaRef.current, 36, 24), 0)
  }

  const canSend = !disabled && (text.trim() || attachments.length > 0)

  return (
    <div className="shrink-0 bg-paper px-3 sm:px-4 pb-3 sm:pb-4 pt-2 pb-safe">
      <div className="max-w-[720px] mx-auto">
        {oversize && (
          <p className="text-claude text-xs mb-2 px-1">内容超过 32000 字符,已截断</p>
        )}
        {error && (
          <p className="text-claude text-xs mb-2 px-1">{error}</p>
        )}

        {/* Attached files row */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 px-1">
            {attachments.map((a) => (
              <AttachmentChip key={a.uploadId} file={a} onRemove={handleRemove} />
            ))}
          </div>
        )}

        {/* Capsule composer */}
        <div className="flex items-end gap-2 border border-line rounded-2xl bg-paper
                        shadow-sm focus-within:border-claude/40 focus-within:shadow-md
                        transition-all px-3 py-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="发消息、问数据,或者上传文件…"
            rows={1}
            className="flex-1 resize-none bg-paper text-ink placeholder:text-muted
                       focus:outline-none text-sm leading-6 py-1"
          />

          {/* File upload */}
          <div className="relative shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFilePick}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg text-muted hover:text-ink hover:bg-hover transition"
              title="上传文件"
            >
              📎
            </button>
          </div>

          {/* Send */}
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="shrink-0 w-9 h-9 rounded-full bg-claude text-paper flex items-center
                       justify-center text-base disabled:opacity-30 disabled:cursor-not-allowed
                       hover:opacity-90 active:scale-95 transition"
            title="发送 (Enter)"
          >
            ↑
          </button>
        </div>

        {/* Keyboard hint row — hidden on mobile */}
        <div className="hidden sm:flex items-center justify-center gap-3 mt-2 text-[11px] text-muted">
          <span><kbd className="px-1.5 py-0.5 rounded border border-line bg-paper">↵</kbd> 发送</span>
          <span><kbd className="px-1.5 py-0.5 rounded border border-line bg-paper">⇧ ↵</kbd> 换行</span>
        </div>
      </div>
    </div>
  )
}