-- admin_create_user RPC에 auth.identities INSERT 추가
-- 문제: 관리자 직접 생성 회원이 auth.identities 레코드 없이 auth.users만 생성되어
--       GoTrue Admin API(updateUserById 등)에서 "User not found" 오류 발생
-- 해결: auth.identities에 email provider 레코드도 함께 생성

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email       TEXT,
  p_password    TEXT,
  p_name        TEXT,
  p_phone       TEXT DEFAULT NULL,
  p_login_id    TEXT DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
DECLARE
  new_id uuid;
BEGIN
  new_id := gen_random_uuid();

  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at
  ) VALUES (
    new_id,
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('name', p_name, 'phone', COALESCE(p_phone, '')),
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  -- auth.identities 레코드 생성 (없으면 GoTrue Admin API가 User not found 반환)
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    new_id,
    new_id,
    jsonb_build_object('sub', new_id::text, 'email', p_email),
    'email',
    p_email,
    now(),
    now(),
    now()
  );

  IF p_login_id IS NOT NULL AND p_login_id != '' THEN
    UPDATE public.users SET login_id = p_login_id WHERE id = new_id;
  END IF;

  RETURN new_id;
END;
$$;

-- 기존에 생성된 관리자 추가 회원 중 auth.identities 누락된 회원 일괄 보완
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT
  au.id,
  au.id,
  jsonb_build_object('sub', au.id::text, 'email', au.email),
  'email',
  au.email,
  now(),
  au.created_at,
  au.updated_at
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities ai WHERE ai.user_id = au.id
)
AND au.email IS NOT NULL;
