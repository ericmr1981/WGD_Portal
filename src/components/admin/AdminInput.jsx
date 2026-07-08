export default function AdminInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  fullWidth = true,
}) {
  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && <label className="block text-sm text-muted mb-1.5">{label}</label>}
      <input
        type={type}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        className={`
          w-full px-4 py-2.5 rounded-lg border
          bg-paper text-ink placeholder:text-muted
          outline-none transition-colors
          focus:border-claude/50 focus:ring-1 focus:ring-claude/20
          hover:border-line/80
          ${error ? 'border-red-400 focus:border-red-400' : 'border-line'}
        `}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}
