# Supabase 账号管理系统设计

## 概述

将 WGD Portal 当前基于 `users.json` + `localStorage` 的本地认证方案，迁移至 Supabase 数据库。使用 SECURITY DEFINER RPC + pgcrypto 实现服务端密码验证和权限控制。

## 数据库 Schema

### users 表

```sql
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### apps 表

```sql
CREATE TABLE apps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '全部',
  "order" INTEGER DEFAULT 0,
  icon TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

用以下命令开启 pgcrypto 扩展：

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## RPC 函数

### 登录（无需认证）

```sql
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
```

### 用户管理（需 admin 身份）

```sql
CREATE OR REPLACE FUNCTION admin_create_user(
  admin_id UUID, p_username TEXT, p_password TEXT, p_name TEXT, p_role TEXT DEFAULT 'user'
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  admin_record RECORD;
BEGIN
  SELECT * INTO admin_record FROM users WHERE id = admin_id AND role = 'admin';
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', '无权限'); END IF;

  INSERT INTO users (username, password_hash, name, role)
  VALUES (p_username, crypt(p_password, gen_salt('bf')), p_name, p_role);

  RETURN json_build_object('success', true);
END;
$$;

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
```

### 应用管理（需 admin 身份）

```sql
CREATE OR REPLACE FUNCTION admin_upsert_app(
  admin_id UUID, p_id UUID DEFAULT NULL, p_name TEXT, p_url TEXT, p_category TEXT, p_order INTEGER, p_icon TEXT DEFAULT ''
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = admin_id AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', '无权限');
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO apps (name, url, category, "order", icon)
    VALUES (p_name, p_url, p_category, p_order, p_icon);
  ELSE
    UPDATE apps SET name=p_name, url=p_url, category=p_category, "order"=p_order, icon=p_icon
    WHERE id = p_id;
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

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
```

### 公开查询

```sql
CREATE OR REPLACE FUNCTION get_apps()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (SELECT json_agg(row_to_json(apps) ORDER BY "order") FROM apps);
END;
$$;
```

## 认证流程

```
登录页输入 username + password
  → supabase.rpc('login_user', { p_username, p_password })
  → PostgreSQL pgcrypto 验证 bcrypt 哈希
  → 成功: 返回 { id, username, name, role }，写入 sessionStorage
  → 失败: 返回错误信息
```

- 使用 `SECURITY DEFINER` 确保 RPC 以函数所有者权限运行
- 密码明文经 HTTPS 传输到 Supabase，服务端用 `crypt() + gen_salt('bf')` 处理
- 登录成功后 session 存储在 `sessionStorage`（与现有方案一致）
- 每次调用管理 RPC 时传入当前用户的 `admin_id`，服务端校验 admin 角色

## 前端变更清单

### 新增依赖

安装 `@supabase/supabase-js`:

```bash
npm install @supabase/supabase-js
```

### 新增文件

**`src/lib/supabase.js`** — Supabase 客户端初始化

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/lib/auth.js` | 移除 `hashPassword()` 和 `usersData` 导入；新增 `login()` 调 RPC；保持 `getSession()/logout()/isAdmin()` 签名一致 |
| `src/lib/data.js` | 新增 `fetchApps()/createUser()/updateUser()/deleteUser()/upsertApp()/deleteApp()` 等 Supabase RPC 封装 |
| `src/pages/login.jsx` | 调用新的 `auth.login()`，无其他 UI 变化 |
| `src/pages/index.jsx` | 从 `data.fetchApps()` 加载应用列表 |
| `src/pages/admin/users.jsx` | 调用 `data.getUsers()` 等替代 localStorage 操作 |
| `src/pages/admin/apps.jsx` | 调用 `data.upsertApp()/deleteApp()` 替代本地 JSON 操作 |

### 新建环境变量

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

## 部署配置

Netlify Dashboard → Site settings → Environment variables 添加：

```
NEXT_PUBLIC_SUPABASE_URL=<项目URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<匿名密钥>
```

构建/导出方式不变：`npm run build` → `out/` 目录发布。

## 初始化数据

首次部署前，在 Supabase SQL Editor 中依次执行：

1. `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
2. 建表 SQL
3. 建 RPC 函数 SQL
4. 插入初始 admin 用户（**请将 `你的初始密码` 替换为实际密码**）：

```sql
INSERT INTO users (username, password_hash, name, role)
VALUES ('admin', crypt('你的初始密码', gen_salt('bf')), '管理员', 'admin');
```
