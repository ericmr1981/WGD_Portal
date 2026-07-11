import { getCurrentUser } from '../../src/lib/auth.js'
import { supabase } from '../../src/lib/supabase.js'

export default async function handler(req, res) {
  const user = getCurrentUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })

  try {
    if (req.method === 'GET') {
      // 走 Supabase public.apps:列名 id(uuid) / order / icon / description / category
      const { data, error } = await supabase
        .from('apps')
        .select('id, name, url, description, icon, category, order')
        .order('order', { ascending: true })
      if (error) throw error
      // uuid → string,前端的 AppCard 用 id 做 React key
      const rows = (data ?? []).map((r) => ({ ...r, id: String(r.id) }))
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      // TODO: 接管理后台写操作时再加 RLS + service_role 校验
      return res.status(501).json({ error: 'not_implemented' })
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}