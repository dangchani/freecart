-- delete_auth_user_direct: auth.users 직접 삭제 RPC
-- 목적: GoTrue Admin API(deleteUser)가 auth.identities 없는 경우 "User not found" 반환할 때
--       fallback으로 auth.users 레코드를 직접 삭제하기 위해 사용

CREATE OR REPLACE FUNCTION public.delete_auth_user_direct(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id;
  DELETE FROM auth.mfa_factors WHERE user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;
