import { motion } from 'framer-motion'

export default function CategoryTabs({ categories, active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`relative px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            active === cat
              ? 'text-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {active === cat && (
            <motion.div
              layoutId="categoryBg"
              className="absolute inset-0 rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{cat}</span>
        </button>
      ))}
    </div>
  )
}
