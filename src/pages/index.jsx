import { useState, useEffect, useMemo } from 'react'
import GlassNav from '../components/GlassNav'
import SearchBar from '../components/SearchBar'
import CategoryTabs from '../components/CategoryTabs'
import AppCard from '../components/AppCard'
import { getApps, getConfig } from '../lib/data'
import { isAdmin } from '../lib/auth'
import { useRouter } from 'next/router'

export default function HomePage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('全部')
  const [apps, setApps] = useState([])
  const router = useRouter()

  const config = getConfig()
  const categories = ['全部', ...(config.categories || [])]

  useEffect(() => {
    getApps().then(setApps)
  }, [])

  const filtered = useMemo(() => {
    return apps.filter((app) => {
      const matchCategory = category === '全部' || app.category === category
      const matchSearch = !search || app.name.toLowerCase().includes(search.toLowerCase()) ||
                          (app.description || '').toLowerCase().includes(search.toLowerCase())
      return matchCategory && matchSearch
    })
  }, [apps, category, search])

  return (
    <div className="min-h-screen">
      <GlassNav />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <p className="text-neon-cyan text-xs font-semibold tracking-widest mb-2">COMPANY PLATFORM</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">工作台</h1>
          <p className="text-gray-500 text-sm mt-2">快速访问你需要的所有工具</p>
        </div>

        <div className="mb-6">
          <SearchBar value={search} onChange={setSearch} />
        </div>

        <div className="mb-6">
          <CategoryTabs categories={categories} active={category} onChange={setCategory} />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg mb-2">暂无匹配的应用</p>
            <p className="text-gray-600 text-sm">试试其他关键词或分类</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map((app, i) => (
              <AppCard key={app.id} app={app} index={i} />
            ))}
          </div>
        )}

        {isAdmin() && (
          <div className="fixed bottom-6 right-6">
            <button
              onClick={() => router.push('/admin')}
              className="glass rounded-full px-5 py-3 text-sm text-neon-cyan hover:border-neon-cyan/30
                         transition-all duration-300"
            >
              管理后台 →
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
