// - POST /api/auth/login → 校验 ops.users,生成 ops.sessions 记录,返回 token
// - POST /api/auth/register → 创建 ops.users (仅 operator?)
// - POST /api/auth/logout → 删除 ops.sessions

import jwt from 'jsonwebtoken'
import crypto from 'crypto'

const DB_URL = process.env.DATABASE_URL || 'postgresql://admin_jlin13:Souledge1981@112.124.18.246:9742/dataplatform'
const JWT_SECRET = process.env.AGENT_JWT_SECRET || process.env.JWT_SECRET || 'dev-secret'

async function migrateSchemaIfNeeded() {
  const { Client } = await import('pg')
  const c = new Client({ connectionString: DB_URL })
  await c.connect()
  // ops.users 表
  await c.query(`
    create table if not exists ops.users (
      user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role in ('admin','operator')),
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  // ops.sessions 表
  await c.query(`
    CREATE TABLE IF NOT EXISTS ops.sessions (
      session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token TEXT NOT NULL UNIQUE,
      user_id UUID NOT NULL REFERENCES ops.users(user_id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await c.end()
  console.log('[auth_api] schema ready')
}

await migrateSchemaIfNeeded()

export default async function handler(req, res) {
  const { method } = req

  if (method === 'POST') {
    try {
      const body = req.body || {}

      // Register
      if (body.action === 'register') {
        const { username, password, role = 'operator' } = body
        if (!username || !password) {
          return res.status(400).json({ error: 'username and password required' })
        }
        // Simple hash for demo
        const hash = crypto.createHash('sha256').update(password + 'salt').digest('hex')

        const { Client } = await import('pg')
        const c = new Client({ connectionString: DB_URL })
        await c.connect()
        try {
          await c.query(
            'INSERT INTO ops.users (username, password_hash, role, enabled) VALUES ($1, $2, $3, true) ON CONFLICT (username) DO NOTHING RETURNING user_id',
            [username, hash, role]
          )
        } finally {
          await c.end()
        }
        return res.status(201).json({ message: '注册成功,请登录' })
      }

      // Login
      const { username, password } = body
      if (!username || !password) return res.status(400).json({ error: 'username and password required' })

      const { Client } = await import('pg')
      const c = new Client({ connectionString: DB_URL })
      await c.connect()

      const { rows } = await c.query(
        'SELECT user_id, username, role, enabled, password_hash FROM ops.users WHERE username = $1 AND enabled = true',
        [username]
      )
      const found = rows[0]
      if (!found) {
        return res.status(401).json({ error: '用户名或密码错误' })
      }

      // Simple verify
      const hash = crypto.createHash('sha256').update(password + 'salt').digest('hex')
      if (found.password_hash !== hash) {
        return res.status(401).json({ error: '用户名或密码错误' })
      }

      // Generate token
      const token = jwt.sign({ sub: found.user_id }, JWT_SECRET, { expiresIn: '7d' })

      // Create session
      await c.query(
        `INSERT INTO ops.sessions (token, user_id, expires_at, last_seen_at)
         VALUES ($1, $2, NOW() + INTERVAL '7 days', NOW()) ON CONFLICT (token) DO UPDATE
         SET user_id = EXCLUDED.user_id, expires_at = EXCLUDED.expires_at, last_seen_at = NOW()`,
        [token, found.user_id]
      )

      await c.end()

      return res.status(200).json({
        token,
        user: {
          id: found.user_id,
          username: found.username,
          role: found.role,
        },
      })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  // Logout: delete session
  if (method === 'POST') {
    // Check if body has logout action or just regular POST to logout endpoint
    const isLogout = (req.body?.action === 'logout' || req.body?.logout === true)

    if (isLogout) {
      const token = req.headers.authorization?.replace('Bearer ', '')
      if (!token) return res.status(401).json({ error: 'unauthorized' })

      const { Client } = await import('pg')
      const c = new Client({ connectionString: DB_URL })
      await c.connect()
      await c.query('DELETE FROM ops.sessions WHERE token = $1', [token])
      await c.end()

      return res.status(200).json({ ok: true })
    }
  }

  res.status(405).json({ error: 'method_not_allowed' })
}