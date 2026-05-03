export default function GlassCard({ children, className = '', onClick }) {
  return (
    <div
      onClick={onClick}
      className={`glass glass-hover rounded-2xl p-6 ${className}`}
    >
      {children}
    </div>
  )
}
