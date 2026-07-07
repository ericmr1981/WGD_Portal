import { useEffect, useState } from 'react'

// 单个 step 的视觉: ◐ 转中 / ● 完成 / ✕ 失败
function StepIcon({ status }) {
  if (status === 'running') {
    return (
      <span className="inline-block w-3 h-3 relative shrink-0">
        <span className="absolute inset-0 rounded-full bg-claude/40 animate-ping" />
        <span className="absolute inset-0 rounded-full bg-claude" />
      </span>
    )
  }
  if (status === 'failed') {
    return <span className="text-claude text-xs shrink-0">✕</span>
  }
  return <span className="text-muted text-xs shrink-0">●</span>
}

export default function StepList({ steps, complete }) {
  if (!steps || steps.length === 0) return null
  return (
    <div className="mt-2 mb-1 space-y-1.5 border-l-2 border-claude/30 pl-3">
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1
        const status = !complete && isLast ? 'running'
          : s.ok === false ? 'failed'
          : 'done'
        return (
          <div key={i} className="flex items-center gap-2 text-xs text-muted">
            <StepIcon status={status} />
            <span className={status === 'running' ? 'text-ink animate-pulse' : 'text-muted'}>
              {s.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}