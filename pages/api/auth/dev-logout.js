// Dev-only logout shim. Clears wgd_session.
export default function handler(req, res) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'not_found' })
  }
  res.setHeader('set-cookie', 'wgd_session=; path=/; SameSite=Lax; max-age=0')
  return res.status(200).json({ ok: true })
}