export default function AdminButton({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
  className = '',
}) {
  const variants = {
    primary: 'bg-ink text-paper hover:opacity-90',
    secondary: 'border border-line text-ink hover:bg-hover',
    danger: 'bg-red-500/10 text-red-600 border border-red-200 hover:bg-red-500/20',
    ghost: 'text-muted hover:text-ink hover:bg-hover',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
        ${variants[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {children}
    </button>
  )
}
