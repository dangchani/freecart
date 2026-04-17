-- ============================================================
-- 이메일 인증 시스템 (Supabase 자체 메일러 완전 제거)
-- ============================================================

-- 1) Supabase 자체 이메일 발송 차단 hook
CREATE OR REPLACE FUNCTION auth.hook_send_email(event jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 모든 auth 이메일 발송을 차단. 인증메일·비번재설정은 우리 SMTP Edge Function에서 처리.
  RETURN;
END;
$$;

-- 2) users 테이블 이메일 인증 완료 시각 컬럼
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- 3) 이메일 인증 토큰 테이블 (가입 인증용, 만료 24시간)
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours',
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token   ON public.email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON public.email_verification_tokens(user_id);

-- 4) 비밀번호 재설정 토큰 테이블 (만료 1시간)
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 hour',
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token   ON public.password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id);

-- 5) 사용하지 않는 settings 키 제거 (Resend, PAT, emailProvider)
DELETE FROM public.settings WHERE key IN ('resend_api_key', 'email_provider', 'supabase_access_token');
