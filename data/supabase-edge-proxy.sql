-- Edge Function 用于验证 session 和查找 app URL
-- 在 Supabase SQL Editor 中运行

-- 验证用户 session 是否有效
CREATE OR REPLACE FUNCTION verify_session(p_user_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
    RETURN json_build_object('valid', true);
  ELSE
    RETURN json_build_object('valid', false);
  END IF;
END;
$$;

-- 根据 app ID 获取 URL
CREATE OR REPLACE FUNCTION get_app_url(p_app_id TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  app_record RECORD;
BEGIN
  -- apps 表的 id 是 UUID 类型，但 launch URI 传的可能是字符串 ID
  -- 尝试 UUID 匹配
  SELECT * INTO app_record FROM apps WHERE id = p_app_id::UUID;

  IF FOUND THEN
    RETURN json_build_object('url', app_record.url);
  END IF;

  RETURN json_build_object('url', null);
EXCEPTION WHEN OTHERS THEN
  -- 如果 p_app_id 不是有效 UUID，或未找到
  RETURN json_build_object('url', null);
END;
$$;
