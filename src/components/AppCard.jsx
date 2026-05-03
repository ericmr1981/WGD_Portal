import { motion } from 'framer-motion'

const iconColors = {
  github: 'from-blue-500 to-cyan-400',
  jira: 'from-neon-purple to-purple-400',
  slack: 'from-pink-500 to-rose-400',
  datadog: 'from-amber-500 to-red-400',
  default: 'from-neon-cyan to-neon-purple',
}

const iconLetters = {
  github: 'G',
  jira: 'J',
  slack: 'S',
  datadog: 'D',
}

export default function AppCard({ app, index }) {
  return (
    <motion.a
      href={app.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="glass glass-card p-5 block group cursor-pointer"
    >
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${iconColors[app.icon] || iconColors.default}
                      flex items-center justify-center text-white font-bold text-lg mb-3
                      group-hover:shadow-[0_0_20px_rgba(0,212,255,0.2)] transition-shadow duration-300`}>
        {iconLetters[app.icon] || app.name.charAt(0)}
      </div>
      <h3 className="text-white font-semibold text-sm mb-1 group-hover:text-neon-cyan transition-colors">
        {app.name}
      </h3>
      <p className="text-gray-500 text-xs leading-relaxed">{app.description}</p>
    </motion.a>
  )
}
