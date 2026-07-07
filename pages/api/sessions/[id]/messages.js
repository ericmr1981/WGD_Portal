import { getCurrentUser } from '../../../../src/lib/auth.js'
import { supabase } from '../../../../src/lib/supabase.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

  const user = getCurrentUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  const id = req.query.id
  if (!id) return res.status(400).json({ error: 'missing_id' })

  const { data: owned } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!owned) return res.status(403).json({ error: 'forbidden' })

  const { data, error } = await supabase
    .from('chat_messages')
    .select('id,role,content,status,created_at')
    .eq('session_id', id)
    .order('created_at', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json(data ?? [])
}
