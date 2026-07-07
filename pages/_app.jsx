import '../src/styles/globals.css'
import { motion, AnimatePresence } from 'framer-motion'
import GlowBackground from '../src/components/GlowBackground'

export default function App({ Component, pageProps, router }) {
  // Auth gating is handled by middleware.js (wgd_session cookie).
  // This shell only provides transition + background.
  return (
    <>
      <GlowBackground />
      <AnimatePresence mode="wait">
        <motion.div
          key={router.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <Component {...pageProps} />
        </motion.div>
      </AnimatePresence>
    </>
  )
}
