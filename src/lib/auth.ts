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
  return data;
}

// joy: 로그인 후 require_signup_approval 토글이 켜져 있고 아직 미승인 사용자라면
// 즉시 로그아웃하고 PENDING_APPROVAL 에러로 알린다. UI에서 안내 메시지 분기에 사용.
export const PENDING_APPROVAL_ERROR = 'PENDING_APPROVAL';

export async function signIn(email: string, password: string) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // 승인 대기 상태 체크
  const { data: profile } = await supabase
    .from('users')
    .select('role, is_approved')
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

export async function updatePassword(newPassword: string) {
  const supabase = createClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}
