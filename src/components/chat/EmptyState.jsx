import { useEffect, useState } from 'react'
import { getPrompts } from '../../lib/data'

// Fallback when DB unavailable
const FALLBACK_PROMPTS = [
  { icon: '📊', title: '业绩速览', desc: '本月各品牌营收对比', prompt: '本月蜜可诗 / 旺鼎阁 / 泰柯茶园的营收分别是多少?做一张对比图' },
  { icon: '⚠️', title: '异常交易', desc: '查看本周风险流水', prompt: '本周银行流水里有哪些待处理风险?列出来' },
  { icon: '💰', title: '账户余额', desc: '当前各账户实时余额', prompt: '现在所有银行账户的余额分别是多少?' },
  { icon: '📈', title: 'KPI 汇总', desc: '各部门实时表现', prompt: '汇总下各部门本周的实时 KPI,标出偏离目标的项' },
]

export default function EmptyState({ onPick }) {
  const [cards, setCards] = useState(FALLBACK_PROMPTS)

  useEffect(() => {
    getPrompts().then((data) => {
      if (data && data.length > 0) setCards(data)
    })
  }, [])

  return (
    <div className="flex-1 flex items-center justify-center px-4 sm:px-6 bg-paper">
      <div className="max-w-[720px] w-full">
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-claude/10 mb-4">
            <span className="text-xl sm:text-2xl">✦</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-ink mb-2">你好,有什么想问的?</h1>
          <p className="text-muted text-xs sm:text-sm">关于蜜可诗 / 旺鼎阁 / 泰柯茶园的数据,都可以聊</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cards.map((p) => (
            <button
              key={p.title}
              onClick={() => onPick(p.prompt)}
              className="group text-left p-4 rounded-xl border border-line bg-paper
                         hover:border-claude/30 hover:bg-hover hover:-translate-y-0.5
                         transition-all duration-200"
            >
              <div className="text-xl mb-2">{p.icon}</div>
              <div className="text-sm font-medium text-ink mb-1 group-hover:text-claude transition-colors">
                {p.title}
              </div>
              <div className="text-xs text-muted">{p.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
