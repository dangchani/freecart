-- 아이디 찾기용 RPC
-- 이름 + 이메일 또는 이름 + 전화번호로 login_id와 가입일을 반환
-- SECURITY DEFINER: 비로그인 사용자도 호출 가능 (RLS 우회), login_id·created_at만 반환
CREATE OR REPLACE FUNCTION find_login_id_by_contact(
  p_name  TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS TABLE (login_id TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT u.login_id, u.created_at
  FROM users u
  WHERE u.name = p_name
    AND (
      (p_email IS NOT NULL AND u.email = p_email)
      OR
      (p_phone IS NOT NULL AND u.phone = p_phone)
    )
  LIMIT 1;
END;
$$;
