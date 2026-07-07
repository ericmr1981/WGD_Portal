import { useState } from 'react'
import BrandSelect from './BrandSelect'
import { clampInput } from '../../lib/useAgentSocket'

export default function Composer({ onSend, disabled }) {
  const [text, setText] = useState('')
  const [brand, setBrand] = useState('')
  const [oversize, setOversize] = useState(false)

  const submit = () => {
    const t = text.trim()
    if (!t) return
    const { text: clamped, oversize: o } = clampInput(text)
    setOversize(o)
    onSend({ content: clamped, brand: brand || null })
    setText('')
  }

  return (
    <div className="border-t border-line bg-paper px-6 py-4">
      <div className="max-w-[720px] mx-auto">
        {oversize && (
          <p className="text-claude text-xs mb-2">内容超过 32000 字符,已截断</p>
        )}
        <div className="flex items-end gap-2 border border-line rounded-2xl px-3 py-2 bg-paper">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // IME (中文拼音/日文/韩文) compose end 也在 keydown 触发 Enter,
              // 需用 keyCode 229 判定 composing 状态
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault()
                submit()
              }
            }}
            onCompositionStart={() => {}}
            onCompositionEnd={(e) => {
              // IME 拼写刚结束,值已同步进 text state,正常走 onChange 路径。
              // 不在此处发,避免回车被吞。
            }}
            placeholder="聊点什么…"
            rows={1}
            className="flex-1 resize-none bg-paper text-ink placeholder:text-muted focus:outline-none text-sm"
            style={{ minHeight: 36, maxHeight: 200 }}
          />
          <BrandSelect value={brand} onChange={setBrand} />
          <button
            onClick={submit}
            disabled={disabled || !text.trim()}
            className="px-4 py-1.5 rounded-lg bg-ink text-paper text-sm
                       disabled:opacity-40 hover:opacity-90 transition"
          >发送</button>
        </div>
      </div>
    </div>
  )
}
