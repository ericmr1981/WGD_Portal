-- ============================================================
-- Supabase 用户管理 RPC（UUID 版 — 匹配现有数据库结构）
-- 不删除表，只新增/替换 RPC 函数
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── admin_get_users ──────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_users(admin_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  SELECT (u.role = 'admin') INTO is_admin FROM public.users u WHERE u.id = admin_id;
  IF NOT is_admin THEN
    RETURN json_build_object('success', false, 'error', 'permission_denied');
  END IF;
  RETURN json_build_object(
    'success', true,
    'users', (SELECT json_agg(row_to_json(r)) FROM (
      SELECT id, username, name, role, created_at FROM public.users ORDER BY created_at DESC
    ) r)
  );
END;
$$;

-- ─── admin_create_user ────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_create_user(
  admin_id    UUID,
  p_username  TEXT,
  p_password  TEXT,
  p_name      TEXT,
  p_role      TEXT DEFAULT 'user'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  is_admin BOOLEAN;
  new_id   UUID;
BEGIN
  SELECT (u.role = 'admin') INTO is_admin FROM public.users u WHERE u.id = admin_id;
  IF NOT is_admin THEN
    RETURN json_build_object('success', false, 'error', 'permission_denied');
  END IF;
  INSERT INTO public.users (username, password_hash, name, role)
  VALUES (p_username, crypt(p_password, gen_salt('bf', 10)), p_name, p_role)
  RETURNING id INTO new_id;
  RETURN json_build_object('success', true, 'id', new_id);
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('success', false, 'error', '用户名已存在');
END;
$$;

-- ─── admin_update_user ────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_update_user(
  admin_id  UUID,
  target_id UUID,
  p_name    TEXT,
  p_role    TEXT DEFAULT 'user'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  SELECT (u.role = 'admin') INTO is_admin FROM public.users u WHERE u.id = admin_id;
  IF NOT is_admin THEN
    RETURN json_build_object('success', false, 'error', 'permission_denied');
  END IF;
  UPDATE public.users SET name = p_name, role = p_role WHERE id = target_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', '用户不存在');
  END IF;
  RETURN json_build_object('success', true);
END;
$$;

-- ─── admin_delete_user ────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_delete_user(admin_id UUID, target_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  SELECT (u.role = 'admin') INTO is_admin FROM public.users u WHERE u.id = admin_id;
  IF NOT is_admin THEN
    RETURN json_build_object('success', false, 'error', 'permission_denied');
  END IF;
  IF admin_id = target_id THEN
    RETURN json_build_object('success', false, 'error', '不能删除自己的账号');
  END IF;
  DELETE FROM public.users WHERE id = target_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', '用户不存在');
  END IF;
  RETURN json_build_object('success', true);
END;
$$;

-- ─── admin_reset_password ─────────────────────────────────
CREATE OR REPLACE FUNCTION admin_reset_password(
  admin_id      UUID,
  target_id     UUID,
  new_password  TEXT
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  SELECT (u.role = 'admin') INTO is_admin FROM public.users u WHERE u.id = admin_id;
  IF NOT is_admin THEN
    RETURN json_build_object('success', false, 'error', 'permission_denied');
  END IF;
  UPDATE public.users SET password_hash = crypt(new_password, gen_salt('bf', 10)) WHERE id = target_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', '用户不存在');
  END IF;
  RETURN json_build_object('success', true);
END;
$$;

-- ─── login_user ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION login_user(p_username TEXT, p_password TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  matched_user RECORD;
BEGIN
  SELECT id, username, name, role, password_hash
  INTO matched_user FROM public.users WHERE username = p_username;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', '账号或密码错误');
  END IF;
  IF matched_user.password_hash = crypt(p_password, matched_user.password_hash) THEN
    RETURN json_build_object(
      'success', true,
      'user', json_build_object(
        'id', matched_user.id,
        'username', matched_user.username,
        'name', matched_user.name,
        'role', matched_user.role
      )
    );
  ELSE
    RETURN json_build_object('success', false, 'error', '账号或密码错误');
  END IF;
END;
$$;

-- ─── 种子（不指定 id，让 DB 自动生成 UUID）────────────────
INSERT INTO public.users (username, password_hash, name, role)
SELECT 'admin', crypt('admin123', gen_salt('bf', 10)), '管理员', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE username = 'admin');

INSERT INTO public.users (username, password_hash, name, role)
SELECT 'zhangsan', crypt('123456', gen_salt('bf', 10)), '张三', 'user'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE username = 'zhangsan');

-- ─── 12. prompts 表 + RPC ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prompts (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  icon       TEXT NOT NULL DEFAULT '📊',
  title      TEXT NOT NULL,
  "desc"     TEXT NOT NULL DEFAULT '',
  prompt     TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION admin_get_prompts()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN json_build_object(
    'success', true,
    'prompts', (SELECT json_agg(row_to_json(r)) FROM (
      SELECT id, icon, title, "desc", prompt, sort_order, created_at
      FROM public.prompts ORDER BY sort_order, created_at DESC
    ) r)
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_upsert_prompt(
  p_id UUID, p_icon TEXT, p_title TEXT, p_desc TEXT, p_prompt TEXT
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_id UUID;
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE public.prompts SET icon = p_icon, title = p_title, "desc" = p_desc, prompt = p_prompt
    WHERE id = p_id;
    RETURN json_build_object('success', true, 'id', p_id);
  ELSE
    INSERT INTO public.prompts (icon, title, "desc", prompt)
    VALUES (p_icon, p_title, p_desc, p_prompt)
    RETURNING id INTO new_id;
    RETURN json_build_object('success', true, 'id', new_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_prompt(p_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.prompts WHERE id = p_id;
  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public_prompts()
RETURNS JSON LANGUAGE sql SECURITY DEFINER AS $$
  SELECT json_build_object(
    'prompts', (SELECT json_agg(row_to_json(r)) FROM (
      SELECT icon, title, "desc", prompt FROM public.prompts ORDER BY sort_order, created_at DESC
    ) r)
  );
$$;

-- 种子
INSERT INTO public.prompts (icon, title, "desc", prompt, sort_order)
SELECT '📊', '业绩速览', '本月各品牌营收对比', '本月蜜可诗 / 旺鼎阁 / 泰柯茶园的营收分别是多少?做一张对比图', 1
WHERE NOT EXISTS (SELECT 1 FROM public.prompts WHERE title = '业绩速览');

INSERT INTO public.prompts (icon, title, "desc", prompt, sort_order)
SELECT '⚠️', '异常交易', '查看本周风险流水', '本周银行流水里有哪些待处理风险?列出来', 2
WHERE NOT EXISTS (SELECT 1 FROM public.prompts WHERE title = '异常交易');

INSERT INTO public.prompts (icon, title, "desc", prompt, sort_order)
SELECT '💰', '账户余额', '当前各账户实时余额', '现在所有银行账户的余额分别是多少?', 3
WHERE NOT EXISTS (SELECT 1 FROM public.prompts WHERE title = '账户余额');

INSERT INTO public.prompts (icon, title, "desc", prompt, sort_order)
SELECT '📈', 'KPI 汇总', '各部门实时表现', '汇总下各部门本周的实时 KPI,标出偏离目标的项', 4
WHERE NOT EXISTS (SELECT 1 FROM public.prompts WHERE title = 'KPI 汇总');
