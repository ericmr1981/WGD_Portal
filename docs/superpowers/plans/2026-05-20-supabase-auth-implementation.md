# Supabase 账号管理系统 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将用户认证和应用数据从本地 JSON/localStorage 迁移到 Supabase 数据库，使用 RPC + pgcrypto 进行密码验证和权限控制。

**Architecture:** 静态 Next.js 应用通过 `@supabase/supabase-js` 客户端直连 Supabase 数据库。登录通过 RPC 在 PostgreSQL 端用 bcrypt 验证密码。管理操作通过 SECURITY DEFINER RPC 在服务端校验 admin 身份。session 仍保存在 sessionStorage。

**Tech Stack:** Supabase (PostgreSQL + pgcrypto), `@supabase/supabase-js`, Next.js (Pages Router, static export)

---

### Task 1: 安装依赖和环境变量

**Files:**
- Modify: `package.json`
- Create: `.env.local`

- [ ] **Step 1: 安装 @supabase/supabase-js**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: 创建 `.env.local`**

从用户获取 Supabase 项目信息后创建：

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

- [ ] **Step 3: 提交**

```bash
git add package.json package-lock.json .env.local
git commit -m "chore: add @supabase/supabase-js dependency and env config"
```

---

### Task 2: 创建 Supabase 客户端

**Files:**
- Create: `src/lib/supabase.js`

- [ ] **Step 1: 创建文件**

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/supabase.js
git commit -m "feat: create Supabase client singleton"
```

---

### Task 3: 在 Supabase SQL Editor 中创建数据库对象

**Files:**
- Execute in Supabase Dashboard → SQL Editor

- [ ] **Step 1: 开启 pgcrypto 扩展**

在 Supabase SQL Editor 中执行：

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

- [ ] **Step 2: 建表**

```sql
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE apps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '全部',
  "order" INTEGER DEFAULT 0,
  icon TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

- [ ] **Step 3: 创建 RPC 函数**

```sql
-- 登录（公开）
CREATE OR REPLACE FUNCTION login_user(p_username TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
BEGIN
  SELECT * INTO user_record FROM users WHERE users.username = p_username;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', '用户不存在');
  END IF;

  IF user_record.password_hash = crypt(p_password, user_record.password_hash) THEN
    RETURN json_build_object(
      'success', true,
      'user', json_build_object(
        'id', user_record.id,
        'username', user_record.username,
        'name', user_record.name,
        'role', user_record.role
      )
    );
  ELSE
    RETURN json_build_object('success', false, 'error', '密码错误');
  END IF;
END;
$$;

-- 获取用户列表（需 admin）
CREATE OR REPLACE FUNCTION admin_get_users(admin_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = admin_id AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', '无权限');
  END IF;

  RETURN json_build_object(
    'success', true,
    'users', (SELECT json_agg(json_build_object(
      'id', id, 'username', username, 'name', name, 'role', role, 'createdAt', created_at
    ) ORDER BY created_at) FROM users)
  );
END;
$$;

-- 创建用户（需 admin）
CREATE OR REPLACE FUNCTION admin_create_user(
  admin_id UUID, p_username TEXT, p_password TEXT, p_name TEXT, p_role TEXT DEFAULT 'user'
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = admin_id AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', '无权限');
  END IF;

  INSERT INTO users (username, password_hash, name, role)
  VALUES (p_username, crypt(p_password, gen_salt('bf')), p_name, p_role);

  RETURN json_build_object('success', true);
END;
$$;

-- 更新用户信息（需 admin）
CREATE OR REPLACE FUNCTION admin_update_user(
  admin_id UUID, target_id UUID, p_name TEXT, p_role TEXT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = admin_id AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', '无权限');
  END IF;

  UPDATE users SET name = p_name, role = p_role WHERE id = target_id;
  RETURN json_build_object('success', true);
END;
$$;

-- 删除用户（需 admin）
CREATE OR REPLACE FUNCTION admin_delete_user(
  admin_id UUID, target_id UUID
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = admin_id AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', '无权限');
  END IF;

  DELETE FROM users WHERE id = target_id;
  RETURN json_build_object('success', true);
END;
$$;

-- 重置密码（需 admin）
CREATE OR REPLACE FUNCTION admin_reset_password(
  admin_id UUID, target_id UUID, new_password TEXT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = admin_id AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', '无权限');
  END IF;

  UPDATE users SET password_hash = crypt(new_password, gen_salt('bf')) WHERE id = target_id;
  RETURN json_build_object('success', true);
END;
$$;

-- 获取应用列表（公开）
CREATE OR REPLACE FUNCTION get_apps()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (SELECT json_agg(json_build_object(
    'id', id, 'name', name, 'url', url, 'category', category,
    'order', "order", 'icon', icon, 'description', description
  ) ORDER BY "order") FROM apps);
END;
$$;

-- 添加/更新应用（需 admin）
CREATE OR REPLACE FUNCTION admin_upsert_app(
  admin_id UUID, p_id UUID DEFAULT NULL, p_name TEXT, p_url TEXT,
  p_category TEXT, p_order INTEGER, p_icon TEXT DEFAULT '', p_description TEXT DEFAULT ''
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = admin_id AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', '无权限');
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO apps (name, url, category, "order", icon, description)
    VALUES (p_name, p_url, p_category, p_order, p_icon, p_description);
  ELSE
    UPDATE apps SET name=p_name, url=p_url, category=p_category,
                    "order"=p_order, icon=p_icon, description=p_description
    WHERE id = p_id;
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- 删除应用（需 admin）
CREATE OR REPLACE FUNCTION admin_delete_app(
  admin_id UUID, app_id UUID
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = admin_id AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', '无权限');
  END IF;

  DELETE FROM apps WHERE id = app_id;
  RETURN json_build_object('success', true);
END;
$$;

-- 重新排序应用（需 admin）
CREATE OR REPLACE FUNCTION admin_reorder_apps(
  admin_id UUID, app_ids UUID[]
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  i INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = admin_id AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', '无权限');
  END IF;

  FOR i IN 1 .. array_length(app_ids, 1) LOOP
    UPDATE apps SET "order" = i WHERE id = app_ids[i];
  END LOOP;

  RETURN json_build_object('success', true);
END;
$$;
```

- [ ] **Step 4: 插入初始数据**

```sql
-- 插入初始 admin 用户（将 '你的初始密码' 替换为实际密码）
INSERT INTO users (username, password_hash, name, role)
VALUES ('admin', crypt('你的初始密码', gen_salt('bf')), '管理员', 'admin');

-- 插入现有应用数据
INSERT INTO apps (id, name, url, icon, category, description, "order")
VALUES (
  'app-005', 'Gelato MiiX', 'https://gelatomiiix.streamlit.app/',
  'custom', '数据分析', 'Streamlit 数据分析应用', 1
);
```

---

### Task 4: 重写 auth.js — Supabase 登录

**Files:**
- Modify: `src/lib/auth.js`

- [ ] **Step 1: 替换 auth.js 内容**

移除 `hashPassword()`、`getUsers()`、`addUser()`、`updateUser()`、`deleteUser()` 以及 `usersData` 导入。保留 `login()` 但改为调用 Supabase RPC。保留 `getSession()`、`logout()`、`isAdmin()` 不变。

```javascript
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
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/auth.js
git commit -m "refactor: use Supabase RPC for login, remove local user CRUD"
```

---

### Task 5: 重写 data.js — Supabase RPC 封装

**Files:**
- Modify: `src/lib/data.js`

- [ ] **Step 1: 替换 data.js 内容**

移除所有 localStorage 读写逻辑，改为调用 Supabase RPC。保留 `getConfig()` 仍从 `config.json` 同步读取（纯配置数据，不需要迁移）。

```javascript
import { supabase } from './supabase'
import { getSession } from './auth'
import configData from '../../data/config.json'

export function getConfig() {
  return configData
}

// ---- Apps ----

export async function getApps() {
  const { data, error } = await supabase.rpc('get_apps')
  if (error) {
    console.error('getApps error:', error)
    return []
  }
  return data || []
}

export async function upsertApp({ id, name, url, category, order, icon, description }) {
  const session = getSession()
  if (!session) return { success: false, error: '未登录' }

  const { data, error } = await supabase.rpc('admin_upsert_app', {
    admin_id: session.id,
    p_id: id || null,
    p_name: name,
    p_url: url,
    p_category: category,
    p_order: order,
    p_icon: icon || '',
    p_description: description || '',
  })

  if (error) return { success: false, error: error.message }
  return data
}

export async function deleteApp(appId) {
  const session = getSession()
  if (!session) return { success: false, error: '未登录' }

  const { data, error } = await supabase.rpc('admin_delete_app', {
    admin_id: session.id,
    app_id: appId,
  })

  if (error) return { success: false, error: error.message }
  return data
}

export async function reorderApps(appIds) {
  const session = getSession()
  if (!session) return { success: false, error: '未登录' }

  const { data, error } = await supabase.rpc('admin_reorder_apps', {
    admin_id: session.id,
    app_ids: appIds,
  })

  if (error) return { success: false, error: error.message }
  return data
}

// ---- Users ----

export async function getUsers() {
  const session = getSession()
  if (!session) return []

  const { data, error } = await supabase.rpc('admin_get_users', {
    admin_id: session.id,
  })

  if (error) return []
  if (!data?.success) return []
  return data.users || []
}

export async function createUser({ username, password, name, role }) {
  const session = getSession()
  if (!session) return { success: false }

  const { data, error } = await supabase.rpc('admin_create_user', {
    admin_id: session.id,
    p_username: username,
    p_password: password,
    p_name: name,
    p_role: role || 'user',
  })

  if (error) return { success: false, error: error.message }
  return data
}

export async function updateUser(id, { name, role }) {
  const session = getSession()
  if (!session) return { success: false }

  const { data, error } = await supabase.rpc('admin_update_user', {
    admin_id: session.id,
    target_id: id,
    p_name: name,
    p_role: role,
  })

  if (error) return { success: false, error: error.message }
  return data
}

export async function deleteUser(id) {
  const session = getSession()
  if (!session) return { success: false }

  const { data, error } = await supabase.rpc('admin_delete_user', {
    admin_id: session.id,
    target_id: id,
  })

  if (error) return { success: false, error: error.message }
  return data
}

export async function resetPassword(userId, newPassword) {
  const session = getSession()
  if (!session) return { success: false }

  const { data, error } = await supabase.rpc('admin_reset_password', {
    admin_id: session.id,
    target_id: userId,
    new_password: newPassword,
  })

  if (error) return { success: false, error: error.message }
  return data
}
```

- [ ] **Step 2: 提交**

```bash
git add src/lib/data.js
git commit -m "refactor: use Supabase RPC for apps and users CRUD"
```

---

### Task 6: 更新 login.jsx

**Files:**
- Modify: `src/pages/login.jsx`

- [ ] **Step 1: 更新 import 路径**

当前已经导入了 `{ login } from '../lib/auth'`，重写后的 auth.js 导出的 `login()` 签名不变（`async (username, password) → session`），所以 **login.jsx 无需任何代码改动**。只需确认即可。

- [ ] **Step 2: 确认无改动后跳过提交**

---

### Task 7: 更新 index.jsx（首页）

**Files:**
- Modify: `src/pages/index.jsx`

- [ ] **Step 1: 改为异步加载应用数据**

将 `loadApps()` 从同步组件顶层调用改为 `useEffect` + `useState` 异步加载：

```jsx
import { useState, useEffect, useMemo } from 'react'
import GlassNav from '../components/GlassNav'
import SearchBar from '../components/SearchBar'
import CategoryTabs from '../components/CategoryTabs'
import AppCard from '../components/AppCard'
import { getApps, getConfig } from '../lib/data'
import { isAdmin } from '../lib/auth'
import { useRouter } from 'next/router'

export default function HomePage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('全部')
  const [apps, setApps] = useState([])
  const router = useRouter()

  const config = getConfig()
  const categories = ['全部', ...(config.categories || [])]

  useEffect(() => {
    getApps().then(setApps)
  }, [])

  const filtered = useMemo(() => {
    return apps.filter((app) => {
      const matchCategory = category === '全部' || app.category === category
      const matchSearch = !search || app.name.toLowerCase().includes(search.toLowerCase()) ||
                          (app.description || '').toLowerCase().includes(search.toLowerCase())
      return matchCategory && matchSearch
    })
  }, [apps, category, search])

  return (
    <div className="min-h-screen">
      <GlassNav />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <p className="text-neon-cyan text-xs font-semibold tracking-widest mb-2">COMPANY PLATFORM</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">工作台</h1>
          <p className="text-gray-500 text-sm mt-2">快速访问你需要的所有工具</p>
        </div>

        <div className="mb-6">
          <SearchBar value={search} onChange={setSearch} />
        </div>

        <div className="mb-6">
          <CategoryTabs categories={categories} active={category} onChange={setCategory} />
        </div>

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

- [ ] **Step 2: 提交**

```bash
git add src/pages/index.jsx
git commit -m "refactor: load apps from Supabase on homepage"
```

---

### Task 8: 更新 admin/index.jsx（管理概览）

**Files:**
- Modify: `src/pages/admin/index.jsx`

- [ ] **Step 1: 改为异步加载数据，修正 import**

移除对 `getUsers()` 的 import，改为从 `data.js` 导入 `getUsers` 和 `getApps`，并用 `useEffect` + `useState` 异步加载：

```jsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSession, isAdmin } from '../../lib/auth'
import GlassNav from '../../components/GlassNav'
import AdminSidebar from '../../components/AdminSidebar'
import GlassCard from '../../components/GlassCard'
import { getApps, getConfig, getUsers } from '../../lib/data'

export default function AdminPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [users, setUsers] = useState([])
  const [apps, setApps] = useState([])
  const config = getConfig()

  useEffect(() => {
    if (!getSession()) {
      router.replace('/login')
    } else if (!isAdmin()) {
      router.replace('/')
    } else {
      setAuthorized(true)
      getUsers().then(setUsers)
      getApps().then(setApps)
    }
  }, [])

  if (!authorized) return null

  return (
    <div className="min-h-screen flex flex-col">
      <GlassNav />
      <div className="flex flex-1 overflow-x-hidden">
        <button onClick={() => setSidebarOpen(true)}
                className="sm:hidden fixed left-3 bottom-20 z-30 glass rounded-full w-12 h-12 flex items-center justify-center text-lg shadow-lg">
          📋
        </button>
        <AdminSidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 p-6 overflow-x-hidden max-w-full">
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

- [ ] **Step 2: 提交**

```bash
git add src/pages/admin/index.jsx
git commit -m "refactor: load admin overview data from Supabase"
```

---

### Task 9: 更新 admin/users.jsx（用户管理）

**Files:**
- Modify: `src/pages/admin/users.jsx`

- [ ] **Step 1: 替换用户管理页面内容**

移除 `hashPassword`、`getUsers`、`addUser`、`updateUser`、`deleteUser` 来自 `auth.js` 的导入，改为从 `data.js` 导入 `getUsers`、`createUser`、`updateUser`、`deleteUser`、`resetPassword`。不再需要 `hashPassword` 和 `generateId`（ID 由数据库生成，密码由数据库 bcrypt 处理）。

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
import { getUsers, createUser, updateUser, deleteUser, resetPassword } from '../../lib/data'

const emptyForm = { username: '', password: '', name: '', role: 'user' }

export default function AdminUsersPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [users, setUsers] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!getSession()) { router.replace('/login'); return }
    if (!isAdmin()) { router.replace('/'); return }
    setAuthorized(true)
    loadUsers()
  }, [])

  const loadUsers = async () => {
    const result = await getUsers()
    setUsers(result)
  }

  const handleSave = async () => {
    if (!form.username.trim() || !form.name.trim()) return
    if (modal.mode === 'add' && !form.password.trim()) return

    if (modal.mode === 'add') {
      await createUser({
        username: form.username,
        password: form.password,
        name: form.name,
        role: form.role,
      })
    } else {
      await updateUser(modal.user.id, { name: form.name, role: form.role })
      if (form.password) {
        await resetPassword(modal.user.id, form.password)
      }
    }

    await loadUsers()
    setModal(null)
    setForm(emptyForm)
  }

  const handleDelete = async () => {
    await deleteUser(deleteTarget.id)
    await loadUsers()
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
      <div className="flex flex-1 overflow-x-hidden">
        <button onClick={() => setSidebarOpen(true)}
                className="sm:hidden fixed left-3 bottom-20 z-30 glass rounded-full w-12 h-12 flex items-center justify-center text-lg shadow-lg">
          📋
        </button>
        <AdminSidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 p-6 overflow-x-hidden max-w-full">
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

- [ ] **Step 2: 提交**

```bash
git add src/pages/admin/users.jsx
git commit -m "refactor: use Supabase for user CRUD in admin panel"
```

---

### Task 10: 更新 admin/apps.jsx（应用管理）

**Files:**
- Modify: `src/pages/admin/apps.jsx`

- [ ] **Step 1: 替换应用管理页面内容**

移除 `loadApps`、`addApp`、`updateApp`、`deleteApp`、`reorderApps`、`generateId` 的导入。改为从 `data.js` 导入 `getApps`、`upsertApp`、`deleteApp`、`reorderApps`。所有操作用 await。

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
import { getApps, upsertApp, deleteApp, reorderApps, getConfig } from '../../lib/data'

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
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!getSession()) { router.replace('/login'); return }
    if (!isAdmin()) { router.replace('/'); return }
    setAuthorized(true)
    setConfigState(getConfig())
    loadApps()
  }, [])

  const loadApps = async () => {
    const result = await getApps()
    setApps(result)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) return

    if (modal.mode === 'add') {
      await upsertApp({ ...form, order: apps.length + 1 })
    } else {
      await upsertApp({ ...form, id: modal.app.id })
    }

    await loadApps()
    setModal(null)
    setForm(emptyForm)
  }

  const handleDelete = async () => {
    await deleteApp(deleteTarget.id)
    await loadApps()
    setDeleteTarget(null)
  }

  const openEdit = (app) => {
    setForm({ name: app.name, url: app.url, icon: app.icon, category: app.category, description: app.description, order: app.order })
    setModal({ mode: 'edit', app })
  }

  const handleDragStart = (id) => setDragId(id)

  const handleDragOver = (e) => e.preventDefault()

  const handleDrop = async (targetId) => {
    if (!dragId || dragId === targetId) return
    const ids = apps.map(a => a.id)
    const fromIdx = ids.indexOf(dragId)
    const toIdx = ids.indexOf(targetId)
    ids.splice(fromIdx, 1)
    ids.splice(toIdx, 0, dragId)
    await reorderApps(ids)
    await loadApps()
    setDragId(null)
  }

  if (!authorized) return null

  return (
    <div className="min-h-screen flex flex-col">
      <GlassNav />
      <div className="flex flex-1 overflow-x-hidden">
        <button onClick={() => setSidebarOpen(true)}
                className="sm:hidden fixed left-3 bottom-20 z-30 glass rounded-full w-12 h-12 flex items-center justify-center text-lg shadow-lg">
          📋
        </button>
        <AdminSidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 p-6 overflow-x-hidden max-w-full">
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
                    <div className="flex flex-col">
                      <p className="text-white font-medium text-sm">{app.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10 w-fit mt-1">
                        {app.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(app)} className="text-xs text-gray-400 hover:text-white transition-colors">编辑</button>
                    <button onClick={() => setDeleteTarget(app)} className="text-xs text-red-400 hover:text-red-300 transition-colors">删除</button>
                  </div>
                </GlassCard>
              </div>
            ))}
          </div>

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

- [ ] **Step 2: 提交**

```bash
git add src/pages/admin/apps.jsx
git commit -m "refactor: use Supabase for app CRUD in admin panel"
```

---

### Task 11: 更新 launch/[id].jsx（应用跳转页）

**Files:**
- Modify: `src/pages/launch/[id].jsx`

- [ ] **Step 1: 改为异步加载应用数据**

```jsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSession } from '../../lib/auth'
import { getApps } from '../../lib/data'

export default function LaunchPage() {
  const router = useRouter()
  const { id } = router.query

  useEffect(() => {
    if (!router.isReady) return

    const session = getSession()
    if (!session) {
      router.replace('/login')
      return
    }

    getApps().then((apps) => {
      const app = apps.find(a => a.id === id)
      if (!app) {
        router.replace('/')
        return
      }
      window.location.replace(app.url)
    })
  }, [router.isReady, id])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-10 w-full max-w-sm text-center border border-neon-cyan/20 neon-glow">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-neon-cyan to-neon-purple animate-pulse" />
        <h1 className="text-lg font-bold text-white mb-2">验证通过，正在跳转...</h1>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add src/pages/launch/\[id\].jsx
git commit -m "refactor: load app data from Supabase in launch page"
```

---

### Task 12: 最终验证

- [ ] **Step 1: 检查所有文件改动**

```bash
git diff --stat
```

确认改动的文件列表：
- `src/lib/supabase.js` (新文件)
- `src/lib/auth.js` (重写)
- `src/lib/data.js` (重写)
- `src/pages/index.jsx` (异步改造)
- `src/pages/admin/index.jsx` (异步改造)
- `src/pages/admin/users.jsx` (异步改造)
- `src/pages/admin/apps.jsx` (异步改造)
- `src/pages/launch/[id].jsx` (异步改造)
- `package.json` (新增依赖)
- `.env.local` (新文件)

- [ ] **Step 2: 构建验证**

```bash
npm run build
```

确认无编译/构建错误。
