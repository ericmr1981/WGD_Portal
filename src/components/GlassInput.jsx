export default function GlassInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
}) {
  return (
    <div>
      {label && <label className="block text-sm text-gray-400 mb-1.5">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
                   text-white placeholder-gray-500 outline-none
                   transition-all duration-300
                   focus:border-neon-cyan/50 focus:shadow-[0_0_15px_rgba(0,212,255,0.1)]
                   hover:border-white/20"
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}
