import jwt from 'jsonwebtoken'

const TOKEN_TTL_SECONDS = 600 // 10 min

export function signAgentToken(userId) {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET not configured')
  }
  if (!userId) {
    throw new Error('userId required')
  }
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  const token = jwt.sign({ sub: userId }, secret, {
    algorithm: 'HS256',
    expiresIn: TOKEN_TTL_SECONDS,
  })
  return { token, exp }
}
