import { supabase } from './supabase'

const STORAGE_KEY = 'wgd_session'

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
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    return session
  }

  return null
}

export function logout() {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function getSession() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function isAdmin() {
  const session = getSession()
  return session?.role === 'admin'
}
