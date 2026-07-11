import '../styles/globals.css'
import { useEffect, useState } from 'react'
import { getSession } from '../lib/auth'
import { motion, AnimatePresence } from 'framer-motion'
import GlowBackground from '../components/GlowBackground'

const publicPaths = ['/login']

export default function App({ Component, pageProps, router }) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 给 /chat 和 / 页面一个短暂宽限期——cookie 可能还没从 localStorage 同步
    const tolerantPaths = ['/chat', '/']
    const session = getSession()
    if (!session && !publicPaths.includes(router.pathname) && !tolerantPaths.includes(router.pathname)) {
      router.replace('/login')
    } else if (session && router.pathname === '/login') {
      router.replace('/')
    }
    setLoading(false)
  }, [router.pathname])

  if (loading) return null

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
