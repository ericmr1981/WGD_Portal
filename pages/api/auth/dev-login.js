// Dev-only login shim. Sets wgd_session cookie with arbitrary {id, username, name, role}.
// Disabled in production.
export default function handler(req, res) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'not_found' })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const { userId, username, name, role } = req.body ?? {}
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId required' })
  }
  const session = {
    id: userId,
    username: username || userId,
    name: name || userId,
    role: role || 'user',
  }
  const encoded = encodeURIComponent(JSON.stringify(session))
  // 7 days, lax, path=/
  res.setHeader(
    'set-cookie',
    `wgd_session=${encoded}; path=/; SameSite=Lax; max-age=604800`,
  )
  return res.status(200).json({ session })
}