export default function SearchBar({ value, onChange }) {
  return (
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">
        🔍
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜索应用..."
        className="w-full glass rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500
                   outline-none transition-all duration-300
                   focus:border-neon-cyan/30 focus:shadow-[0_0_15px_rgba(0,212,255,0.05)]
                   hover:border-white/10"
      />
    </div>
  )
}
