import { getCurrentUser } from '../../../src/lib/auth.js'
import { supabase } from '../../../src/lib/supabase.js'

async function ownSession(userId, id) {
  const { data } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  return Boolean(data)
}

export default async function handler(req, res) {
  const user = getCurrentUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  const id = req.query.id
  if (!id) return res.status(400).json({ error: 'missing_id' })

  const owns = await ownSession(user.id, id)
  if (!owns) return res.status(403).json({ error: 'forbidden' })

  if (req.method === 'PATCH') {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : null
    if (!title) return res.status(400).json({ error: 'title_required' })
    const { data, error } = await supabase
      .from('chat_sessions')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id,title,updated_at')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('chat_sessions').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'method_not_allowed' })
}
