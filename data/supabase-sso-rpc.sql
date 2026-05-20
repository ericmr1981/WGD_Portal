-- 在 Supabase SQL Editor 中运行

-- SSO 令牌表
CREATE TABLE IF NOT EXISTS sso_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  user_name TEXT NOT NULL DEFAULT '',
  user_role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '8 hours',
  used BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_sso_tokens_expires ON sso_tokens(expires_at);

-- 创建 SSO 令牌（Edge Function 调用）
CREATE OR REPLACE FUNCTION create_sso_token(p_user_id UUID, p_user_name TEXT, p_user_role TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  token_id UUID;
BEGIN
  INSERT INTO sso_tokens (user_id, user_name, user_role, expires_at)
  VALUES (p_user_id, p_user_name, p_user_role, now() + interval '8 hours')
  RETURNING id INTO token_id;
  RETURN json_build_object('token', token_id);
END;
$$;

-- 验证 SSO 令牌（Streamlit 应用调用）
CREATE OR REPLACE FUNCTION verify_sso_token(p_token UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  token_record RECORD;
BEGIN
  SELECT * INTO token_record FROM sso_tokens WHERE id = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', '令牌不存在');
  END IF;

  IF token_record.expires_at < now() THEN
    RETURN json_build_object('valid', false, 'error', '令牌已过期');
  END IF;

  RETURN json_build_object(
    'valid', true,
    'user_id', token_record.user_id,
    'user_name', token_record.user_name,
    'role', token_record.user_role
  );
END;
$$;
