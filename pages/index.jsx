import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function HomeRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/chat')
  }, [router])
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper text-muted text-sm">
      正在跳转到对话界面…
    </div>
  )
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/chat',
      permanent: false,
    },
  }
}
