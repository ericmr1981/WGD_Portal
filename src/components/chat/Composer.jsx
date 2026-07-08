import { useState, useRef } from 'react'
import BrandSelect from './BrandSelect'
import { clampInput } from '../../lib/useAgentSocket'

// Attachment item in textarea
function AttachmentItem({ fileName, uploadId, onRemove }) {
  return (
    <button
      onClick={() => onRemove(uploadId)}
      className="inline-flex items-center gap-1.5 px-2 py-1 bg-ink/10 text-ink text-xs rounded-md hover:bg-ink/20"
    >
      <span>📎 {fileName}</span>
      <span className="text-muted">×</span>
    </button>
  )
}

export default function Composer({ onSend, disabled }) {
  const [text, setText] = useState('')
  const [brand, setBrand] = useState('')
  const [attachments, setAttachments] = useState([])
  const [oversize, setOversize] = useState(false)
  const fileInputRef = useRef(null)
  const uploadInputRef = useRef(null)
  const [pendingUploadId, setPendingUploadId] = useState(null)

  const placeholders = [
    '今天银行流水里有哪些待处理风险？',
    '帮我看下这个月的业绩',
    '汇总下各部门的实时 KPI',
  ]

  const submit = async () => {
    const t = text.trim()
    if (!t && attachments.length === 0) return
    const { text: clamped, oversize: o } = clampInput(text)
    setOversize(o)
    const payload = {
      content: clamped,
      brand: brand || null,
      attachments: attachments.map((a) => ({ type: 'file', uploadId: a })),
    }
    onSend(payload)
    setText('')
    setAttachments([])
  }

  const handleFilePick = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)

    try {
      setPendingUploadId(file.name.slice(0, 20)) // show pending state
      const r = await fetch('/api/uploads', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (!r.ok) throw new Error()
      const { uploadId, filename } = await r.json()
      setAttachments((arr) => [...arr, { fileName: filename, uploadId }])
    } catch {
      alert('上传失败,请重试')
    } finally {
      setPendingUploadId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemove = (uploadId) => {
    setAttachments((arr) => arr.filter((a) => a.uploadId !== uploadId))
  }

  return (
    <div className="shrink-0 border-t border-line bg-paper px-6 py-4">
      <div className="max-w-[720px] mx-auto space-y-1">
        {oversize && (
          <p className="text-claude text-xs mb-2">内容超过 32000 字符,已截断</p>
        )}
        <div className="flex items-end gap-2 border border-line rounded-2xl px-3 py-2 bg-paper">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault()
                submit()
              }
            }}
            onCompositionStart={() => {}}
            onCompositionEnd={(e) => {}}
            placeholder={placeholders[Math.floor(Math.random() * placeholders.length)]}
            rows={1}
            className="flex-1 resize-none bg-paper text-ink placeholder:text-muted focus:outline-none text-sm"
            style={{ minHeight: 36, maxHeight: 200 }}
          />
          <BrandSelect value={brand} onChange={setBrand} />

          {/* File upload button */}
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFilePick}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg hover:bg-hover text-muted hover:text-ink transition"
              title="上传文件"
            >
              📎
            </button>
          </div>

          <button
            onClick={submit}
            disabled={disabled || (!text.trim() && attachments.length === 0)}
            className="px-4 py-1.5 rounded-lg bg-ink text-paper text-sm disabled:opacity-40 hover:opacity-90 transition"
          >
            {pendingUploadId ? '上传中...' : '发送'}
          </button>
        </div>

        {/* Attached files */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((a) => (
              <AttachmentItem
                key={a.uploadId}
                fileName={a.fileName}
                uploadId={a.uploadId}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}