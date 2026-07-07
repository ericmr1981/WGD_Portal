const CHIPS = [
  '上月蜜可诗 GMV 多少?',
  '现在账户余额多少?',
  '本周异常交易?',
]

export default function EmptyState({ onPick }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 bg-paper">
      <div className="max-w-[720px] w-full text-center">
        <h2 className="text-xl font-semibold text-ink mb-2">问吧</h2>
        <p className="text-muted text-sm mb-6">关于蜜可诗 / 旺鼎阁 / 泰柯茶园的数据,都能聊</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => onPick(c)}
              className="text-sm px-3 py-1.5 rounded-full border border-line text-ink hover:bg-hover"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
