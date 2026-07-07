import { getCurrentUser } from '../../../src/lib/auth.js'
import { supabase } from '../../../src/lib/supabase.js'

export default async function handler(req, res) {
  const user = getCurrentUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id,brand,title,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data ?? [])
  }

  if (req.method === 'POST') {
    const brand = typeof req.body?.brand === 'string' ? req.body.brand : null
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ user_id: user.id, brand })
      .select('id,brand,title,created_at')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  return res.status(405).json({ error: 'method_not_allowed' })
}
