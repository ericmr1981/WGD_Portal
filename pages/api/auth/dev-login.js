import { supabase } from '../../../src/lib/supabase'

// Dev-only login shim. Looks up real user from Supabase by userId/username,
// then sets wgd_session cookie with the real DB UUID as id.
// Disabled in production.
export default async function handler(req, res) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'not_found' })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const { userId } = req.body ?? {}
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId required' })
  }

  // Look up real user from DB (by id first, then by username)
  const { data: user } = await supabase
    .from('users')
    .select('id, username, name, role')
    .or(`id.eq.${userId},username.eq.${userId}`)
    .maybeSingle()

  // Fallback: if DB lookup fails (e.g. E2E test user), allow any userId
  const session = user ? {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  } : {
    id: userId,
    username: userId,
    name: userId,
    role: userId === 'admin' ? 'admin' : 'user',
  }
  const encoded = encodeURIComponent(JSON.stringify(session))
  // 7 days, lax, path=/
  res.setHeader(
    'set-cookie',
    `wgd_session=${encoded}; path=/; SameSite=Lax; max-age=604800`,
  )
  return res.status(200).json({ session, token: '' })
}