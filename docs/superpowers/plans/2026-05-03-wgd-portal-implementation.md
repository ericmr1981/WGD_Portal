# WGD Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a company portal with glass-style login, app dashboard, and admin CRUD for users/apps, deployed as a Next.js static site on Netlify.

**Architecture:** Next.js Pages Router with static export. All data stored in bundled JSON files with localStorage persistence for admin CRUD changes. Client-side auth using Web Crypto SHA-256.

**Tech Stack:** Next.js 14 (Pages Router), Tailwind CSS, Framer Motion, Web Crypto API

---

## File Structure

```
WGD_Portal/
├── next.config.js            # Static export config: output: 'export'
├── package.json              # Dependencies: next, react, framer-motion, tailwindcss
├── tailwind.config.js        # Theme: dark glass colors, backdrop-blur utilities
├── postcss.config.js         # Tailwind + autoprefixer
├── data/
│   ├── users.json            # Seed users (admin default)
│   ├── apps.json             # Seed app catalog
│   └── config.json           # Site config (name, categories)
├── src/
│   ├── lib/
│   │   ├── auth.js           # Login/logout, session management, Crypto hash
│   │   └── data.js           # Read seed data, merge localStorage overrides
│   ├── components/
│   │   ├── GlowBackground.jsx    # Animated floating gradient orbs
│   │   ├── GlassCard.jsx         # Reusable frosted-glass container
│   │   ├── GlassInput.jsx        # Glass-styled input with glow focus
│   │   ├── GlassButton.jsx       # Gradient button with hover shimmer
│   │   ├── Modal.jsx             # Reusable modal dialog
│   │   ├── GlassNav.jsx          # Top navigation bar (homepage)
│   │   ├── AuthGuard.jsx         # Route guard wrapper
│   │   ├── AppCard.jsx           # App card for homepage grid
│   │   ├── CategoryTabs.jsx      # Horizontal category filter
│   │   ├── SearchBar.jsx         # Search input with icon
│   │   └── AdminSidebar.jsx      # Admin section sidebar
│   ├── pages/
│   │   ├── _app.jsx              # AuthGuard + global layout
│   │   ├── _document.jsx         # HTML document customizations
│   │   ├── login.jsx             # Glass login card page
│   │   ├── index.jsx             # Home dashboard page
│   │   └── admin/
│   │       ├── index.jsx         # Admin overview (stats)
│   │       ├── users.jsx         # User CRUD page
│   │       └── apps.jsx          # App CRUD + drag sort page
│   └── styles/
│       └── globals.css           # Tailwind directives + glass keyframes
└── netlify.toml              # Netlify deploy config
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `next.config.js`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "wgd-portal",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "framer-motion": "^11.0.0"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0"
  }
}
```

- [ ] **Step 2: Create next.config.js**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
}

module.exports = nextConfig
```

- [ ] **Step 3: Create tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        glass: {
          DEFAULT: 'rgba(255, 255, 255, 0.04)',
          border: 'rgba(255, 255, 255, 0.08)',
          hover: 'rgba(255, 255, 255, 0.08)',
        },
        neon: {
          cyan: '#00d4ff',
          purple: '#7c3aed',
        },
        space: {
          DEFAULT: '#0a0e1a',
          light: '#0d1117',
        },
      },
      backdropBlur: {
        glass: '20px',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 4: Create postcss.config.js**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 5: Install dependencies and verify**

Run: `npm install`
Expected: `node_modules/` created, no errors

- [ ] **Step 6: Commit**

```bash
git add package.json next.config.js tailwind.config.js postcss.config.js package-lock.json
git commit -m "chore: scaffold Next.js project with Tailwind"
```

---

### Task 2: Data Files

**Files:**
- Create: `data/users.json`
- Create: `data/apps.json`
- Create: `data/config.json`

- [ ] **Step 1: Create data/users.json**

Pre-hashed password for "admin123" using SHA-256. Since we can't pre-compute it here, use a known hash value. The default admin account:
- username: `admin`
- password: `admin123`
- The SHA-256 hash of "admin123" is `240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9`

```json
[
  {
    "id": "admin",
    "username": "admin",
    "password": "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9",
    "name": "管理员",
    "role": "admin",
    "createdAt": "2026-05-03"
  },
  {
    "id": "user-001",
    "username": "zhangsan",
    "password": "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9",
    "name": "张三",
    "role": "user",
    "createdAt": "2026-05-03"
  }
]
```

- [ ] **Step 2: Create data/apps.json**

```json
[
  {
    "id": "app-001",
    "name": "GitHub",
    "url": "https://github.com",
    "icon": "github",
    "category": "开发工具",
    "description": "代码托管与协作平台",
    "order": 1
  },
  {
    "id": "app-002",
    "name": "Jira",
    "url": "https://jira.company.com",
    "icon": "jira",
    "category": "项目管理",
    "description": "项目任务跟踪管理",
    "order": 2
  },
  {
    "id": "app-003",
    "name": "Slack",
    "url": "https://slack.com",
    "icon": "slack",
    "category": "沟通协作",
    "description": "团队即时通讯工具",
    "order": 3
  },
  {
    "id": "app-004",
    "name": "Datadog",
    "url": "https://datadog.com",
    "icon": "datadog",
    "category": "数据分析",
    "description": "应用性能监控平台",
    "order": 4
  }
]
```

- [ ] **Step 3: Create data/config.json**

```json
{
  "siteName": "WGD Portal",
  "categories": ["开发工具", "数据分析", "项目管理", "沟通协作"],
  "defaultCategory": "全部"
}
```

- [ ] **Step 4: Commit**

```bash
git add data/
git commit -m "feat: add seed data files for users, apps, and config"
```

---

### Task 3: Global Styles & Glass CSS

**Files:**
- Create: `src/styles/globals.css`

- [ ] **Step 1: Create globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-space text-white antialiased;
    min-height: 100vh;
  }
  
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }
}

@layer utilities {
  .glass {
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .glass-hover {
    transition: all 0.3s ease;
  }
  .glass-hover:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(0, 212, 255, 0.3);
    box-shadow: 0 0 30px rgba(0, 212, 255, 0.08);
  }
  .glass-card {
    @apply glass glass-hover rounded-2xl;
  }
  .neon-glow {
    box-shadow: 0 0 20px rgba(0, 212, 255, 0.15);
  }
  .text-gradient {
    background: linear-gradient(135deg, #00d4ff, #7c3aed);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-20px) scale(1.05); }
}

@keyframes shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat: add global styles and glass CSS utilities"
```

---

### Task 4: Auth Library

**Files:**
- Create: `src/lib/auth.js`

- [ ] **Step 1: Create auth.js**

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth.js
git commit -m "feat: add auth library with login/logout and user CRUD"
```

---

### Task 5: Data Library

**Files:**
- Create: `src/lib/data.js`

- [ ] **Step 1: Create data.js**

```js
import appsData from '../../data/apps.json'
import configData from '../../data/config.json'

export function getConfig() {
  return configData
}

export function loadApps() {
  try {
    const local = localStorage.getItem('wgd_apps_override')
    if (local) {
      const overrides = JSON.parse(local)
      return appsData.map(a => {
        const override = overrides.find(o => o.id === a.id)
        return override ? { ...a, ...override } : a
      }).concat(
        overrides.filter(o => !appsData.find(a => a.id === o.id))
      )
    }
  } catch {}
  return appsData
}

function saveApps(apps) {
  localStorage.setItem('wgd_apps_override', JSON.stringify(apps))
}

export function addApp(app) {
  const apps = loadApps()
  apps.push(app)
  saveApps(apps)
  return apps
}

export function updateApp(id, updates) {
  const apps = loadApps()
  const idx = apps.findIndex(a => a.id === id)
  if (idx === -1) return apps
  apps[idx] = { ...apps[idx], ...updates }
  saveApps(apps)
  return apps
}

export function deleteApp(id) {
  let apps = loadApps()
  apps = apps.filter(a => a.id !== id)
  saveApps(apps)
  return apps
}

export function reorderApps(ids) {
  const apps = loadApps()
  const sorted = ids.map((id, i) => {
    const app = apps.find(a => a.id === id)
    if (app) return { ...app, order: i + 1 }
    return null
  }).filter(Boolean)
  saveApps(sorted)
  return sorted
}

export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data.js
git commit -m "feat: add data library with app CRUD and reorder"
```

---

### Task 6: Core UI Components

**Files:**
- Create: `src/components/GlowBackground.jsx`
- Create: `src/components/GlassCard.jsx`
- Create: `src/components/GlassInput.jsx`
- Create: `src/components/GlassButton.jsx`
- Create: `src/components/Modal.jsx`

- [ ] **Step 1: Create GlowBackground.jsx**

```jsx
import { useEffect, useState } from 'react'

export default function GlowBackground() {
  const [orbs, setOrbs] = useState([])

  useEffect(() => {
    setOrbs([
      { top: '10%', left: '80%', size: 400, color: 'rgba(0, 212, 255, 0.08)', delay: 0 },
      { top: '60%', left: '10%', size: 300, color: 'rgba(124, 58, 237, 0.06)', delay: 2.5 },
      { top: '70%', left: '75%', size: 250, color: 'rgba(0, 212, 255, 0.05)', delay: 5 },
    ])
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {orbs.map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            top: orb.top,
            left: orb.left,
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
            animation: `float 8s ease-in-out ${orb.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create GlassCard.jsx**

```jsx
export default function GlassCard({ children, className = '', onClick }) {
  return (
    <div
      onClick={onClick}
      className={`glass glass-hover rounded-2xl p-6 ${className}`}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Create GlassInput.jsx**

```jsx
export default function GlassInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
}) {
  return (
    <div>
      {label && <label className="block text-sm text-gray-400 mb-1.5">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 
                   text-white placeholder-gray-500 outline-none
                   transition-all duration-300
                   focus:border-neon-cyan/50 focus:shadow-[0_0_15px_rgba(0,212,255,0.1)]
                   hover:border-white/20"
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Create GlassButton.jsx**

```jsx
export default function GlassButton({ children, onClick, type = 'button', className = '', disabled }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        relative overflow-hidden rounded-xl px-6 py-3 font-semibold text-white
        bg-gradient-to-r from-neon-cyan to-neon-purple
        transition-all duration-300
        hover:shadow-[0_4px_20px_rgba(0,212,255,0.3)]
        active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      <span className="relative z-10">{children}</span>
      <div className="absolute inset-0 bg-[length:200%_100%] bg-gradient-to-r from-transparent via-white/20 to-transparent 
                      opacity-0 hover:opacity-100 transition-opacity duration-500"
           style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }} />
    </button>
  )
}
```

- [ ] **Step 5: Create Modal.jsx**

```jsx
import { motion, AnimatePresence } from 'framer-motion'

export default function Modal({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative glass rounded-2xl p-6 w-full max-w-md border border-white/10"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-xl leading-none">&times;</button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/GlowBackground.jsx src/components/GlassCard.jsx src/components/GlassInput.jsx src/components/GlassButton.jsx src/components/Modal.jsx
git commit -m "feat: add core UI components (GlowBackground, GlassCard, GlassInput, GlassButton, Modal)"
```

---

### Task 7: Login Page

**Files:**
- Create: `src/pages/_app.jsx`
- Create: `src/pages/_document.jsx`
- Create: `src/pages/login.jsx`

- [ ] **Step 1: Create _document.jsx**

```jsx
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="zh-CN">
      <Head>
        <meta name="theme-color" content="#0a0e1a" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
```

- [ ] **Step 2: Create _app.jsx**

```jsx
import '../styles/globals.css'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { getSession } from '../lib/auth'
import { motion, AnimatePresence } from 'framer-motion'
import GlowBackground from '../components/GlowBackground'

const publicPaths = ['/login']

export default function App({ Component, pageProps, router }) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const session = getSession()
    if (!session && !publicPaths.includes(router.pathname)) {
      router.replace('/login')
    } else if (session && router.pathname === '/login') {
      router.replace('/')
    }
    setLoading(false)
  }, [router.pathname])

  if (loading) return null

  return (
    <>
      <GlowBackground />
      <AnimatePresence mode="wait">
        <motion.div
          key={router.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <Component {...pageProps} />
        </motion.div>
      </AnimatePresence>
    </>
  )
}
```

- [ ] **Step 3: Create login.jsx**

```jsx
import { useState } from 'react'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { login } from '../lib/auth'
import GlassInput from '../components/GlassInput'
import GlassButton from '../components/GlassButton'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const session = await login(username, password)
      if (session) {
        router.push('/')
      } else {
        setError('账号或密码错误')
      }
    } catch {
      setError('登录失败，请重试')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="glass rounded-2xl p-8 sm:p-10 w-full max-w-sm border border-neon-cyan/20 neon-glow"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-neon-cyan to-neon-purple 
                          shadow-[0_0_20px_rgba(0,212,255,0.3)]" />
          <h1 className="text-2xl font-bold text-white">WGD Portal</h1>
          <p className="text-gray-500 text-sm mt-1">公司应用门户</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className={error ? 'animate-[shake_0.3s_ease]' : ''}>
            <GlassInput
              label="账号"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入账号"
            />
          </div>
          <div className={error ? 'animate-[shake_0.3s_ease]' : ''}>
            <GlassInput
              label="密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <GlassButton type="submit" className="w-full" disabled={loading}>
            {loading ? '登录中...' : '登 录'}
          </GlassButton>
        </form>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 4: Add shake animation to globals.css**

Edit `src/styles/globals.css` to add before the `@layer utilities` closing:

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}
```

- [ ] **Step 5: Verify build works**

Run: `npm run build`
Expected: Success with exported static pages for `/login` and `/404`

- [ ] **Step 6: Commit**

```bash
git add src/pages/_app.jsx src/pages/_document.jsx src/pages/login.jsx src/styles/globals.css
git commit -m "feat: add login page with glass card and auth flow"
```

---

### Task 8: Navigation Component

**Files:**
- Create: `src/components/GlassNav.jsx`

- [ ] **Step 1: Create GlassNav.jsx**

```jsx
import { useRouter } from 'next/router'
import { getSession, logout, isAdmin } from '../lib/auth'
import { useState } from 'react'

export default function GlassNav() {
  const router = useRouter()
  const session = getSession()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <nav className="glass border-b border-white/5 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-cyan to-neon-purple" />
          <span className="text-white font-bold text-lg">WGD Portal</span>
        </div>

        {/* Desktop right */}
        <div className="hidden sm:flex items-center gap-4">
          {isAdmin() && (
            <button
              onClick={() => router.push('/admin')}
              className={`text-sm transition-colors ${
                router.pathname.startsWith('/admin') ? 'text-neon-cyan' : 'text-gray-400 hover:text-white'
              }`}
            >
              管理后台
            </button>
          )}
          <span className="text-sm text-gray-300">{session?.name}</span>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center text-white text-sm font-medium">
            {session?.name?.charAt(0) || 'U'}
          </div>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-white transition-colors">
            退出
          </button>
        </div>

        {/* Mobile hamburger */}
        <button className="sm:hidden text-white text-2xl" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden glass border-t border-white/5 px-4 py-4 space-y-3">
          <div className="flex items-center gap-3 pb-3 border-b border-white/5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center text-white text-sm font-medium">
              {session?.name?.charAt(0) || 'U'}
            </div>
            <div>
              <p className="text-white text-sm">{session?.name}</p>
              <p className="text-gray-500 text-xs">{session?.role === 'admin' ? '管理员' : '员工'}</p>
            </div>
          </div>
          {isAdmin() && (
            <button onClick={() => { router.push('/admin'); setMenuOpen(false) }}
                    className="block w-full text-left text-sm text-gray-300 py-2">
              管理后台
            </button>
          )}
          <button onClick={handleLogout} className="block w-full text-left text-sm text-gray-500 py-2">
            退出登录
          </button>
        </div>
      )}
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/GlassNav.jsx
git commit -m "feat: add GlassNav component with desktop/mobile menu"
```

---

### Task 9: Homepage Components

**Files:**
- Create: `src/components/AppCard.jsx`
- Create: `src/components/CategoryTabs.jsx`
- Create: `src/components/SearchBar.jsx`

- [ ] **Step 1: Create AppCard.jsx**

```jsx
import { motion } from 'framer-motion'
import { useState } from 'react'

const iconColors = {
  github: 'from-blue-500 to-cyan-400',
  jira: 'from-neon-purple to-purple-400',
  slack: 'from-pink-500 to-rose-400',
  datadog: 'from-amber-500 to-red-400',
  default: 'from-neon-cyan to-neon-purple',
}

const iconLetters = {
  github: 'G',
  jira: 'J',
  slack: 'S',
  datadog: 'D',
}

export default function AppCard({ app, index }) {
  const [imgError, setImgError] = useState(false)

  return (
    <motion.a
      href={app.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="glass glass-card p-5 block group cursor-pointer"
    >
      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${iconColors[app.icon] || iconColors.default}
                      flex items-center justify-center text-white font-bold text-lg mb-3
                      group-hover:shadow-[0_0_20px_rgba(0,212,255,0.2)] transition-shadow duration-300`}>
        {iconLetters[app.icon] || app.name.charAt(0)}
      </div>

      {/* Name */}
      <h3 className="text-white font-semibold text-sm mb-1 group-hover:text-neon-cyan transition-colors">
        {app.name}
      </h3>

      {/* Description */}
      <p className="text-gray-500 text-xs leading-relaxed">{app.description}</p>
    </motion.a>
  )
}
```

- [ ] **Step 2: Create CategoryTabs.jsx**

```jsx
import { motion } from 'framer-motion'

export default function CategoryTabs({ categories, active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={`relative px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            active === cat
              ? 'text-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {active === cat && (
            <motion.div
              layoutId="categoryBg"
              className="absolute inset-0 rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{cat}</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create SearchBar.jsx**

```jsx
export default function SearchBar({ value, onChange }) {
  return (
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">
        🔍
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜索应用..."
        className="w-full glass rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 
                   outline-none transition-all duration-300
                   focus:border-neon-cyan/30 focus:shadow-[0_0_15px_rgba(0,212,255,0.05)]
                   hover:border-white/10"
      />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/AppCard.jsx src/components/CategoryTabs.jsx src/components/SearchBar.jsx
git commit -m "feat: add homepage components (AppCard, CategoryTabs, SearchBar)"
```

---

### Task 10: Homepage

**Files:**
- Create: `src/pages/index.jsx`

- [ ] **Step 1: Create index.jsx**

```jsx
import { useState, useMemo } from 'react'
import GlassNav from '../components/GlassNav'
import SearchBar from '../components/SearchBar'
import CategoryTabs from '../components/CategoryTabs'
import AppCard from '../components/AppCard'
import { loadApps, getConfig } from '../lib/data'
import { isAdmin } from '../lib/auth'
import { useRouter } from 'next/router'

export default function HomePage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('全部')
  const router = useRouter()

  const config = getConfig()
  const apps = loadApps()
  const categories = ['全部', ...config.categories]

  const filtered = useMemo(() => {
    return apps.filter((app) => {
      const matchCategory = category === '全部' || app.category === category
      const matchSearch = !search || app.name.toLowerCase().includes(search.toLowerCase()) ||
                          app.description.toLowerCase().includes(search.toLowerCase())
      return matchCategory && matchSearch
    })
  }, [apps, category, search])

  return (
    <div className="min-h-screen">
      <GlassNav />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <p className="text-neon-cyan text-xs font-semibold tracking-widest mb-2">COMPANY PLATFORM</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">工作台</h1>
          <p className="text-gray-500 text-sm mt-2">快速访问你需要的所有工具</p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <SearchBar value={search} onChange={setSearch} />
        </div>

        {/* Categories */}
        <div className="mb-6">
          <CategoryTabs categories={categories} active={category} onChange={setCategory} />
        </div>

        {/* App Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg mb-2">暂无匹配的应用</p>
            <p className="text-gray-600 text-sm">试试其他关键词或分类</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map((app, i) => (
              <AppCard key={app.id} app={app} index={i} />
            ))}
          </div>
        )}

        {/* Admin quick link */}
        {isAdmin() && (
          <div className="fixed bottom-6 right-6">
            <button
              onClick={() => router.push('/admin')}
              className="glass rounded-full px-5 py-3 text-sm text-neon-cyan hover:border-neon-cyan/30
                         transition-all duration-300"
            >
              管理后台 →
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: Success, no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.jsx
git commit -m "feat: add homepage with app grid, search, and category filter"
```

---

### Task 11: Admin Sidebar

**Files:**
- Create: `src/components/AdminSidebar.jsx`

- [ ] **Step 1: Create AdminSidebar.jsx**

```jsx
import { useRouter } from 'next/router'

const links = [
  { href: '/admin', label: '概览', icon: '📊' },
  { href: '/admin/users', label: '用户管理', icon: '👥' },
  { href: '/admin/apps', label: '应用管理', icon: '📦' },
]

export default function AdminSidebar() {
  const router = useRouter()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex flex-col w-56 glass h-[calc(100vh-4rem)] border-r border-white/5 p-4 shrink-0">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">管理后台</p>
        <nav className="space-y-1">
          {links.map((link) => {
            const active = router.pathname === link.href
            return (
              <button
                key={link.href}
                onClick={() => router.push(link.href)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${
                  active
                    ? 'bg-gradient-to-r from-neon-cyan/10 to-neon-purple/10 text-white border border-neon-cyan/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden flex glass border-t border-white/5">
        {links.map((link) => {
          const active = router.pathname === link.href
          return (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className={`flex-1 flex flex-col items-center py-3 text-xs transition-colors ${
                active ? 'text-neon-cyan' : 'text-gray-500'
              }`}
            >
              <span className="text-lg mb-0.5">{link.icon}</span>
              <span>{link.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AdminSidebar.jsx
git commit -m "feat: add AdminSidebar with desktop sidebar and mobile bottom nav"
```

---

### Task 12: Admin Overview Page

**Files:**
- Create: `src/pages/admin/index.jsx`

- [ ] **Step 1: Create admin/index.jsx**

```jsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSession, isAdmin } from '../../lib/auth'
import GlassNav from '../../components/GlassNav'
import AdminSidebar from '../../components/AdminSidebar'
import GlassCard from '../../components/GlassCard'
import { loadApps, getConfig } from '../../lib/data'
import { getUsers } from '../../lib/auth'

export default function AdminPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    if (!getSession()) {
      router.replace('/login')
    } else if (!isAdmin()) {
      router.replace('/')
    } else {
      setAuthorized(true)
    }
  }, [])

  if (!authorized) return null

  const users = getUsers()
  const apps = loadApps()
  const config = getConfig()

  return (
    <div className="min-h-screen flex flex-col">
      <GlassNav />
      <div className="flex flex-1">
        <AdminSidebar />
        <main className="flex-1 p-6 overflow-auto">
          <h1 className="text-2xl font-bold text-white mb-6">管理概览</h1>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <GlassCard>
              <p className="text-gray-400 text-sm mb-1">用户总数</p>
              <p className="text-3xl font-bold text-white">{users.length}</p>
            </GlassCard>
            <GlassCard>
              <p className="text-gray-400 text-sm mb-1">应用总数</p>
              <p className="text-3xl font-bold text-white">{apps.length}</p>
            </GlassCard>
            <GlassCard>
              <p className="text-gray-400 text-sm mb-1">分类数</p>
              <p className="text-3xl font-bold text-white">{config.categories.length}</p>
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GlassCard className="cursor-pointer hover:border-neon-cyan/30" onClick={() => router.push('/admin/users')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">用户管理</p>
                  <p className="text-white text-sm mt-1">添加、编辑或删除用户</p>
                </div>
                <span className="text-2xl">👥</span>
              </div>
            </GlassCard>
            <GlassCard className="cursor-pointer hover:border-neon-cyan/30" onClick={() => router.push('/admin/apps')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">应用管理</p>
                  <p className="text-white text-sm mt-1">管理应用列表和排序</p>
                </div>
                <span className="text-2xl">📦</span>
              </div>
            </GlassCard>
          </div>
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/index.jsx
git commit -m "feat: add admin overview page with stats"
```

---

### Task 13: Admin Users Page

**Files:**
- Create: `src/pages/admin/users.jsx`

- [ ] **Step 1: Create admin/users.jsx**

```jsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSession, isAdmin, getUsers, addUser, updateUser, deleteUser, hashPassword } from '../../lib/auth'
import GlassNav from '../../components/GlassNav'
import AdminSidebar from '../../components/AdminSidebar'
import GlassCard from '../../components/GlassCard'
import GlassInput from '../../components/GlassInput'
import GlassButton from '../../components/GlassButton'
import Modal from '../../components/Modal'
import { generateId } from '../../lib/data'

const emptyForm = { username: '', password: '', name: '', role: 'user' }

export default function AdminUsersPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [users, setUsers] = useState([])
  const [modal, setModal] = useState(null) // { mode: 'add'|'edit', user? }
  const [form, setForm] = useState(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    if (!getSession()) { router.replace('/login'); return }
    if (!isAdmin()) { router.replace('/'); return }
    setAuthorized(true)
    setUsers(getUsers())
  }, [])

  const refresh = () => setUsers([...getUsers()])

  const handleSave = async () => {
    if (modal.mode === 'add') {
      addUser({
        id: generateId(),
        username: form.username,
        password: await hashPassword(form.password),
        name: form.name,
        role: form.role,
        createdAt: new Date().toISOString().split('T')[0],
      })
    } else {
      const updates = {}
      if (form.password) updates.password = await hashPassword(form.password)
      updateUser(modal.user.id, { ...form, ...updates })
    }
    refresh()
    setModal(null)
    setForm(emptyForm)
  }

  const handleDelete = () => {
    deleteUser(deleteTarget.id)
    refresh()
    setDeleteTarget(null)
  }

  const openEdit = (user) => {
    setForm({ username: user.username, password: '', name: user.name, role: user.role })
    setModal({ mode: 'edit', user })
  }

  if (!authorized) return null

  return (
    <div className="min-h-screen flex flex-col">
      <GlassNav />
      <div className="flex flex-1">
        <AdminSidebar />
        <main className="flex-1 p-6 overflow-auto pb-20 sm:pb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">用户管理</h1>
            <GlassButton onClick={() => { setForm(emptyForm); setModal({ mode: 'add' }) }}>
              + 添加用户
            </GlassButton>
          </div>

          <div className="space-y-3">
            {users.map((user) => (
              <GlassCard key={user.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple 
                                  flex items-center justify-center text-white font-medium">
                    {user.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{user.name}</p>
                    <p className="text-gray-500 text-xs">{user.username}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    user.role === 'admin' 
                      ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20'
                      : 'bg-white/5 text-gray-400 border border-white/10'
                  }`}>
                    {user.role === 'admin' ? '管理员' : '员工'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(user)} className="text-xs text-gray-400 hover:text-white transition-colors">编辑</button>
                  <button onClick={() => setDeleteTarget(user)} className="text-xs text-red-400 hover:text-red-300 transition-colors">删除</button>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Add/Edit Modal */}
          <Modal open={!!modal} onClose={() => { setModal(null); setForm(emptyForm) }} title={modal?.mode === 'add' ? '添加用户' : '编辑用户'}>
            <div className="space-y-4">
              <GlassInput label="用户名" value={form.username} onChange={(e) => setForm({...form, username: e.target.value})} />
              <GlassInput label="显示名称" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
              <GlassInput label={modal?.mode === 'edit' ? '新密码（留空不修改）' : '密码'} type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} />
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">角色</label>
                <select value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none">
                  <option value="user">员工</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              <GlassButton onClick={handleSave} className="w-full">
                {modal?.mode === 'add' ? '添加' : '保存'}
              </GlassButton>
            </div>
          </Modal>

          {/* Delete Confirmation */}
          <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="确认删除">
            <p className="text-gray-400 text-sm mb-6">确定要删除用户 <span className="text-white">{deleteTarget?.name}</span> 吗？此操作不可撤销。</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 glass rounded-xl py-3 text-sm text-gray-300">取消</button>
              <button onClick={handleDelete} className="flex-1 bg-red-500/20 border border-red-500/30 rounded-xl py-3 text-sm text-red-400">删除</button>
            </div>
          </Modal>
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/users.jsx
git commit -m "feat: add admin users page with CRUD operations"
```

---

### Task 14: Admin Apps Page

**Files:**
- Create: `src/pages/admin/apps.jsx`

- [ ] **Step 1: Create admin/apps.jsx**

```jsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSession, isAdmin } from '../../lib/auth'
import GlassNav from '../../components/GlassNav'
import AdminSidebar from '../../components/AdminSidebar'
import GlassCard from '../../components/GlassCard'
import GlassInput from '../../components/GlassInput'
import GlassButton from '../../components/GlassButton'
import Modal from '../../components/Modal'
import { loadApps, addApp, updateApp, deleteApp, reorderApps, getConfig, generateId } from '../../lib/data'

const emptyForm = { name: '', url: '', icon: '', category: '', description: '', order: 1 }

const iconOptions = [
  { value: 'github', label: 'GitHub', color: 'from-blue-500 to-cyan-400' },
  { value: 'jira', label: 'Jira', color: 'from-neon-purple to-purple-400' },
  { value: 'slack', label: 'Slack', color: 'from-pink-500 to-rose-400' },
  { value: 'datadog', label: 'Datadog', color: 'from-amber-500 to-red-400' },
  { value: 'custom', label: '自定义', color: 'from-neon-cyan to-neon-purple' },
]

export default function AdminAppsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [apps, setApps] = useState([])
  const [config, setConfigState] = useState(null)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [dragId, setDragId] = useState(null)

  useEffect(() => {
    if (!getSession()) { router.replace('/login'); return }
    if (!isAdmin()) { router.replace('/'); return }
    setAuthorized(true)
    setApps(loadApps())
    setConfigState(getConfig())
  }, [])

  const refresh = () => setApps([...loadApps()])

  const handleSave = () => {
    if (modal.mode === 'add') {
      addApp({ id: generateId(), ...form, order: apps.length + 1 })
    } else {
      updateApp(modal.app.id, form)
    }
    refresh()
    setModal(null)
    setForm(emptyForm)
  }

  const handleDelete = () => {
    deleteApp(deleteTarget.id)
    refresh()
    setDeleteTarget(null)
  }

  const openEdit = (app) => {
    setForm({ name: app.name, url: app.url, icon: app.icon, category: app.category, description: app.description, order: app.order })
    setModal({ mode: 'edit', app })
  }

  const handleDragStart = (id) => setDragId(id)

  const handleDragOver = (e) => e.preventDefault()

  const handleDrop = (targetId) => {
    if (!dragId || dragId === targetId) return
    const ids = apps.map(a => a.id)
    const fromIdx = ids.indexOf(dragId)
    const toIdx = ids.indexOf(targetId)
    ids.splice(fromIdx, 1)
    ids.splice(toIdx, 0, dragId)
    reorderApps(ids)
    refresh()
    setDragId(null)
  }

  if (!authorized) return null

  return (
    <div className="min-h-screen flex flex-col">
      <GlassNav />
      <div className="flex flex-1">
        <AdminSidebar />
        <main className="flex-1 p-6 overflow-auto pb-20 sm:pb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">应用管理</h1>
            <GlassButton onClick={() => { setForm(emptyForm); setModal({ mode: 'add' }) }}>
              + 添加应用
            </GlassButton>
          </div>

          <p className="text-gray-500 text-xs mb-4">拖拽卡片可调整排序</p>

          <div className="space-y-3">
            {apps.map((app) => (
              <div
                key={app.id}
                draggable
                onDragStart={() => handleDragStart(app.id)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(app.id)}
                className={`transition-opacity ${dragId === app.id ? 'opacity-50' : ''}`}
              >
                <GlassCard className="flex items-center justify-between p-4 cursor-grab active:cursor-grabbing">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-600 text-sm cursor-move">⠿</span>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${
                      iconOptions.find(o => o.value === app.icon)?.color || iconOptions[4].color
                    } flex items-center justify-center text-white font-medium text-sm`}>
                      {app.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{app.name}</p>
                      <p className="text-gray-500 text-xs">{app.url}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
                      {app.category}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(app)} className="text-xs text-gray-400 hover:text-white transition-colors">编辑</button>
                    <button onClick={() => setDeleteTarget(app)} className="text-xs text-red-400 hover:text-red-300 transition-colors">删除</button>
                  </div>
                </GlassCard>
              </div>
            ))}
          </div>

          {/* Add/Edit Modal */}
          <Modal open={!!modal} onClose={() => { setModal(null); setForm(emptyForm) }} title={modal?.mode === 'add' ? '添加应用' : '编辑应用'}>
            <div className="space-y-4">
              <GlassInput label="应用名称" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
              <GlassInput label="URL" value={form.url} onChange={(e) => setForm({...form, url: e.target.value})} placeholder="https://" />
              <GlassInput label="描述" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">图标</label>
                <select value={form.icon} onChange={(e) => setForm({...form, icon: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none">
                  {iconOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">分类</label>
                <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none">
                  {config?.categories?.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <GlassButton onClick={handleSave} className="w-full">
                {modal?.mode === 'add' ? '添加' : '保存'}
              </GlassButton>
            </div>
          </Modal>

          {/* Delete Confirmation */}
          <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="确认删除">
            <p className="text-gray-400 text-sm mb-6">确定要删除应用 <span className="text-white">{deleteTarget?.name}</span> 吗？</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 glass rounded-xl py-3 text-sm text-gray-300">取消</button>
              <button onClick={handleDelete} className="flex-1 bg-red-500/20 border border-red-500/30 rounded-xl py-3 text-sm text-red-400">删除</button>
            </div>
          </Modal>
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: All pages export successfully, no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/apps.jsx
git commit -m "feat: add admin apps page with CRUD and drag reorder"
```

---

### Task 15: Netlify Deployment Config

**Files:**
- Create: `netlify.toml`

- [ ] **Step 1: Create netlify.toml**

```toml
[build]
  command = "npm run build"
  publish = "out"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- [ ] **Step 2: Final build verification**

Run: `npm run build`
Expected: `out/` directory contains all pages, no errors

- [ ] **Step 3: Commit**

```bash
git add netlify.toml
git commit -m "chore: add Netlify deployment config"
```

---

## Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| Login page with glass card | Task 7 |
| Dark theme, cyan/purple gradient colors | Task 3 (globals.css) |
| Animated glow background | Task 6 (GlowBackground) |
| Floating orbs animation | Task 6 (GlowBackground) |
| Card fade-in animation | Task 6 (GlassCard) + Task 9 (AppCard stagger) |
| Input focus glow | Task 6 (GlassInput) |
| Button hover shimmer | Task 6 (GlassButton) |
| Error shake animation | Task 7 (login page) |
| Homepage app grid (3/2 cols) | Task 10 (index.jsx) |
| Search bar | Task 9 (SearchBar) |
| Category tabs | Task 9 (CategoryTabs) |
| GlassNav top bar | Task 8 |
| Auth guard (redirect if not logged in) | Task 7 (_app.jsx) |
| Admin guard (redirect non-admin) | Task 12 (admin/index.jsx) |
| Admin overview with stats | Task 12 |
| User CRUD | Task 13 |
| App CRUD | Task 14 |
| Drag reorder apps | Task 14 |
| JSON data files | Task 2 |
| Netlify static export | Task 15 |
| Mobile responsive | Throughout (all pages) |
| Nav logout button | Task 8 (GlassNav) |
| Admin quick link on homepage | Task 10 (index.jsx) |
