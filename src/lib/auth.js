import { supabase } from './supabase'

const STORAGE_KEY = 'wgd_session'
const COOKIE_KEY = 'wgd_session'

function setSessionCookie(session) {
  const encoded = encodeURIComponent(JSON.stringify(session))
  document.cookie = `${COOKIE_KEY}=${encoded}; path=/; SameSite=Lax; max-age=604800`
}

function clearSessionCookie() {
  document.cookie = `${COOKIE_KEY}=; path=/; SameSite=Lax; max-age=0`
}

export async function login(username, password) {
  const { data, error } = await supabase.rpc('login_user', {
    p_username: username,
    p_password: password,
  })

  if (error) {
    console.error('Login error:', error)
    return null
  }

  if (data?.success) {
    const session = {
      id: data.user.id,
      username: data.user.username,
      name: data.user.name,
      role: data.user.role,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    setSessionCookie(session)
    return session
  }

  return null
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
  clearSessionCookie()
}

export function getSession() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const session = JSON.parse(raw)
      // Sync to localStorage if found in sessionStorage
      if (sessionStorage.getItem(STORAGE_KEY) && !localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, raw)
      }
      return session
    }
    return null
  } catch {
    return null
  }
}

export function isAdmin() {
  const session = getSession()
  return session?.role === 'admin'
}

/**
 * 在 API route 中读取当前用户。
 * 解析 wgd_session cookie(JSON string) → 返回 {id, username, role}。
 * 不抛错;非法 cookie 返回 null。
 */
export function getCurrentUser(req) {
  const cookieHeader =
    (req.headers && (req.headers.cookie || req.headers.get?.('cookie'))) || ''
  const match = cookieHeader.match(/(?:^|;\s*)wgd_session=([^;]+)/)
  if (!match) return null
  try {
    const session = JSON.parse(decodeURIComponent(match[1]))
    if (!session?.id) return null
    return {
      id: session.id,
      username: session.username ?? null,
      role: session.role ?? 'user',
    }
  } catch {
    return null
  }
}
