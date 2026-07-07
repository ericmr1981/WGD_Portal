const OPTIONS = [
  { value: '', label: '不限品牌' },
  { value: '蜜可诗', label: '蜜可诗' },
  { value: '旺鼎阁', label: '旺鼎阁' },
  { value: '泰柯茶园', label: '泰柯茶园' },
]

export default function BrandSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm bg-paper border border-line rounded-md px-2 py-1 text-ink focus:outline-none focus:border-claude"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
