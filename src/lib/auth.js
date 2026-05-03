import usersData from '../../data/users.json'

const STORAGE_KEY = 'wgd_session'

export async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function loadUsers() {
  try {
    const local = localStorage.getItem('wgd_users_override')
    if (local) {
      const overrides = JSON.parse(local)
      return usersData.map(u => {
        const override = overrides.find(o => o.id === u.id)
        return override ? { ...u, ...override } : u
      })
    }
  } catch {}
  return usersData
}

function saveUsers(users) {
  localStorage.setItem('wgd_users_override', JSON.stringify(users))
}

export async function login(username, password) {
  const users = loadUsers()
  const hash = await hashPassword(password)
  const user = users.find(u => u.username === username && u.password === hash)
  if (!user) return null
  const session = { id: user.id, username: user.username, name: user.name, role: user.role }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  return session
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

export function getUsers() {
  return loadUsers()
}

export function addUser(user) {
  const users = loadUsers()
  users.push(user)
  saveUsers(users)
  return users
}

export function updateUser(id, updates) {
  const users = loadUsers()
  const idx = users.findIndex(u => u.id === id)
  if (idx === -1) return users
  users[idx] = { ...users[idx], ...updates }
  saveUsers(users)
  return users
}

export function deleteUser(id) {
  let users = loadUsers()
  users = users.filter(u => u.id !== id)
  saveUsers(users)
  return users
}
