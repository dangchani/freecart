-- update_user_password_direct: auth.users 비밀번호 직접 업데이트 RPC
-- 목적: GoTrue Admin API(updateUserById)는 auth.identities가 없으면 "User not found" 반환.
--       관리자 직접 생성 회원(auth.identities 누락)의 비밀번호도 변경할 수 있도록
--       auth.users.encrypted_password를 직접 업데이트하는 SECURITY DEFINER RPC.

CREATE OR REPLACE FUNCTION public.update_user_password_direct(
  p_user_id  uuid,
  p_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, extensions, public
AS $$
BEGIN
  UPDATE auth.users
  SET
    encrypted_password  = crypt(p_password, gen_salt('bf')),
    updated_at          = now(),
    -- 미인증 상태면 함께 확인 처리 (임시 비밀번호 발급 시 로그인 가능하도록)
    email_confirmed_at  = COALESCE(email_confirmed_at, now())
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;
END;
$$;
