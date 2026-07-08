import { getCurrentUser } from '../../src/lib/auth.js'
import { Client } from 'pg'

const DB_URL = process.env.DATABASE_URL || 'postgresql://admin_jlin13:Souledge1981@112.124.18.246:9742/dataplatform'

async function ensureSchema() {
  const c = new Client({ connectionString: DB_URL })
  await c.connect()
  await c.query(`
    CREATE TABLE IF NOT EXISTS ops.apps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      category TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await c.end()
}

export default async function handler(req, res) {
  const user = getCurrentUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })

  try {
    await ensureSchema()
    const c = new Client({ connectionString: DB_URL })
    await c.connect()

    if (req.method === 'GET') {
      const { rows } = await c.query(
        'SELECT id, name, url, description, icon, category, sort_order FROM ops.apps WHERE enabled = true ORDER BY sort_order ASC, created_at DESC'
      )
      await c.end()
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      // admin only
      if (user.role !== 'admin') {
        await c.end()
        return res.status(403).json({ error: 'forbidden' })
      }
      const { name, url, description = '', icon = '', category = '', sort_order = 0 } = req.body || {}
      if (!name || !url) {
        await c.end()
        return res.status(400).json({ error: 'name and url required' })
      }
      const { rows } = await c.query(
        'INSERT INTO ops.apps (name, url, description, icon, category, sort_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [name, url, description, icon, category, sort_order]
      )
      await c.end()
      return res.status(201).json(rows[0])
    }

    await c.end()
    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
