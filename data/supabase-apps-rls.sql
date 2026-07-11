-- 在 Supabase SQL Editor 跑:开启 anon 对 public.apps 的读权限

-- 1. 确认 RLS 已开
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;

-- 2. 给 anon + authenticated 角色都开 SELECT
DROP POLICY IF EXISTS "apps_read_all" ON public.apps;
CREATE POLICY "apps_read_all" ON public.apps
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 3. 验证策略生效(应该返 8 条)
SELECT count(*) AS apps_visible_to_anon FROM public.apps;
