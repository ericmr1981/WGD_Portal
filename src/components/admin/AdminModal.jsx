import { AnimatePresence, motion } from 'framer-motion'

export default function AdminModal({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="relative bg-paper border border-line rounded-2xl shadow-md w-full max-w-md"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
              <button
                onClick={onClose}
                className="p-1 rounded hover:text-claude/80 transition-colors"
              >×</button>
            </div>
            <div className="px-6 py-4">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
