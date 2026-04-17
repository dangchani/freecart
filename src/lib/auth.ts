import { createClient } from './supabase/client';
import type { User } from '@/types';

export async function signUp(email: string, password: string, name: string) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  });

  if (error) throw error;

  // 웹훅 트리거 (fire-and-forget)
  import('@/services/webhooks').then(({ triggerWebhook }) =>
    triggerWebhook('member.created', { email }),
  ).catch(() => {});

  return data;
}

// joy: 로그인 후 require_signup_approval 토글이 켜져 있고 아직 미승인 사용자라면
// 즉시 로그아웃하고 PENDING_APPROVAL 에러로 알린다. UI에서 안내 메시지 분기에 사용.
export const PENDING_APPROVAL_ERROR    = 'PENDING_APPROVAL';
export const EMAIL_NOT_VERIFIED_ERROR  = 'EMAIL_NOT_VERIFIED';

// joy: 아이디 기반 로그인 — login_id로 이메일을 조회한 뒤 signInWithPassword 호출.
//   RPC get_email_by_login_id는 SECURITY DEFINER로 RLS 없이 이메일만 반환.
//   아이디 미존재/비밀번호 불일치 모두 동일 에러로 처리해 계정 존재 여부 미노출.
export async function signIn(loginId: string, password: string) {
  const supabase = createClient();

  const { data: email } = await supabase.rpc('get_email_by_login_id', { p_login_id: loginId });
  if (!email) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // 승인 대기 상태 체크
  const { data: profile } = await supabase
    .from('users')
    .select('role, is_approved, must_change_password, email_verified_at')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profile && profile.role === 'user' && profile.is_approved === false) {
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'require_signup_approval')
      .maybeSingle();

    if (setting?.value === true) {
      await supabase.auth.signOut();
      throw new Error(PENDING_APPROVAL_ERROR);
    }
  }

  // 이메일 인증 필수 설정 시 미인증 사용자 차단 (관리자 제외)
  if (profile?.role === 'user') {
    const { data: emailConfirmSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'email_confirm_required')
      .maybeSingle();
    const required = emailConfirmSetting?.value === '"true"' || emailConfirmSetting?.value === 'true';
    if (required && !profile.email_verified_at) {
      await supabase.auth.signOut();
      throw new Error(EMAIL_NOT_VERIFIED_ERROR);
    }
  }

  // joy: 임시 비밀번호(아임웹 마이그레이션) 사용자는 즉시 비밀번호 변경 페이지로 안내
  if (profile?.must_change_password === true) {
    throw new Error('MUST_CHANGE_PASSWORD');
  }

  return data;
}

export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    loginId: profile.login_id ?? undefined,
    name: profile.name,
    phone: profile.phone,
    role: profile.role,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

export async function updateProfile(userId: string, data: Partial<User>) {
  const supabase = createClient();

  const { error } = await supabase
    .from('users')
    .update({
      name: data.name,
      phone: data.phone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) throw error;
}

export async function resetPassword(email: string) {
  const supabase = createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });

  if (error) throw error;
}

// joy: 아이디로 비밀번호 재설정 링크 발송.
//   Supabase 자체 메일러 대신 우리 SMTP Edge Function(send-password-reset) 사용.
//   보안상 아이디 미존재 여부와 무관하게 성공 응답 (타이밍 공격 방지).
export async function resetPasswordByLoginId(loginId: string) {
  const supabase = createClient();
  await supabase.functions.invoke('send-password-reset', { body: { loginId } });
}

// joy: 이름 + 이메일 또는 이름 + 전화번호로 login_id와 가입일을 조회.
//   RPC find_login_id_by_contact는 SECURITY DEFINER로 RLS 없이 처리.
//   미존재 시 NOT_FOUND 에러로 UI에서 분기.
export async function findLoginIdByContact(params: {
  name: string;
  method: 'email' | 'phone';
  contact: string;
}): Promise<{ loginId: string; createdAt: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('find_login_id_by_contact', {
    p_name:  params.name,
    p_email: params.method === 'email' ? params.contact : null,
    p_phone: params.method === 'phone' ? params.contact : null,
  });
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('NOT_FOUND');
  return { loginId: data[0].login_id, createdAt: data[0].created_at };
}

// joy: 비밀번호 재설정 토큰으로 비밀번호 변경. reset-password-with-token Edge Function 사용.
export async function resetPasswordWithToken(token: string, newPassword: string) {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke('reset-password-with-token', {
    body: { token, newPassword },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}
