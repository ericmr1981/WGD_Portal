-- 在 Supabase SQL Editor 跑:补 public.apps 的 seed 数据
-- 假设表已存在,列:id (uuid) / name / url / category / order / icon / description / created_at

-- 4 个应用,UUID 用 gen_random_uuid() 生成
INSERT INTO public.apps (id, name, url, category, "order", icon, description) VALUES
  (gen_random_uuid(), '蜜可诗管理后台', 'https://mks.example.com',  '蜜可诗',   10, '🛍️', '蜜可诗门店运营数据'),
  (gen_random_uuid(), '旺鼎阁 POS',     'https://pos.example.com',  '旺鼎阁',   20, '🍽️', '旺鼎阁门店收银系统'),
  (gen_random_uuid(), '泰柯茶园管理',   'https://tkc.example.com',  '泰柯茶园', 30, '🍵', '茶园种植与库存'),
  (gen_random_uuid(), '财务看板',       'https://finance.example.com', '集团',  40, '📊', '集团统一财务数据')
ON CONFLICT DO NOTHING;

-- 验证
SELECT id, name, url, category, "order" FROM public.apps ORDER BY "order";
