-- ensure_auth_identity: auth.identities 레코드가 없으면 생성하는 RPC
-- 목적: 관리자 직접 생성 회원은 auth.identities 없이 auth.users만 생성됨
--       signInWithPassword가 auth.identities 없으면 로그인 거부하므로
--       임시 비밀번호 발급 전 자동으로 identity 레코드를 보완

CREATE OR REPLACE FUNCTION public.ensure_auth_identity(
  p_user_id uuid,
  p_email   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  SELECT
    p_user_id,
    p_user_id,
    jsonb_build_object('sub', p_user_id::text, 'email', p_email),
    'email',
    p_email,
    now(),
    now(),
    now()
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = p_user_id
  );
END;
$$;
