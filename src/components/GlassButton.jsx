export default function GlassButton({ children, onClick, type = 'button', className = '', disabled }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        relative overflow-hidden rounded-xl px-6 py-3 font-semibold text-white
        bg-gradient-to-r from-neon-cyan to-neon-purple
        transition-all duration-300
        hover:shadow-[0_4px_20px_rgba(0,212,255,0.3)]
        active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      <span className="relative z-10">{children}</span>
      <div className="absolute inset-0 bg-[length:200%_100%] bg-gradient-to-r from-transparent via-white/20 to-transparent
                      opacity-0 hover:opacity-100 transition-opacity duration-500"
           style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }} />
    </button>
  )
}
