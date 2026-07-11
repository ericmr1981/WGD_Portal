import { useState, useEffect, useMemo } from 'react'
import AppCard from '../src/components/AppCard'
import { supabase } from '../src/lib/supabase'

export default function HomePage() {
  const [apps, setApps] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('全部')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('apps')
        .select('id, name, url, description, icon, category, order')
        .order('order', { ascending: true })
      if (cancelled) return
      if (!error) setApps((data ?? []).map((r) => ({ ...r, id: String(r.id) })))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const categories = useMemo(
    () => ['全部', ...Array.from(new Set(apps.map((a) => a.category).filter(Boolean)))],
    [apps]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return apps.filter((a) => {
      const matchCat = category === '全部' || a.category === category
      const matchQ = !q || a.name.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q)
      return matchCat && matchQ
    })
  }, [apps, category, search])

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-paper">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-claude/10 text-claude text-sm flex items-center justify-center">✦</span>
            <span className="text-sm font-semibold text-ink">WGD Portal</span>
          </div>
          <a href="/chat" className="text-sm text-muted hover:text-claude transition">前往对话 →</a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p className="text-xs text-claude font-semibold tracking-widest mb-2">APPLICATIONS</p>
          <h1 className="text-3xl font-semibold text-ink">应用中心</h1>
          <p className="text-muted text-sm mt-2">访问你日常使用的所有业务系统</p>
        </div>

        {/* Search + category filter */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索应用…"
            className="flex-1 px-4 py-2 rounded-lg border border-line bg-paper text-ink text-sm
                       focus:outline-none focus:border-claude focus:ring-1 focus:ring-claude"
          />
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-sm transition
                            ${category === c
                              ? 'bg-claude text-paper'
                              : 'border border-line text-ink hover:bg-hover'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* App grid */}
        {loading ? (
          <p className="text-muted text-sm py-12 text-center">加载中…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted text-sm py-12 text-center">没有匹配的应用</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((app, i) => (
              <AppCard key={app.id} app={app} index={i} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}