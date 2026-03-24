import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // 초기 사용자 로드
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        loadUserProfile(user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // 인증 상태 변경 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserProfile(userId: string) {
    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[useAuth] Failed to load user profile:', error.message);
      setLoading(false);
      return;
    }

    // 프로필이 없으면 (DB trigger가 아직 실행 안됐거나 기존 유저)
    if (!profile) {
      console.warn('[useAuth] Profile not found. DB trigger may not be installed.');
      setLoading(false);
      return;
    }

    setUser({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      phone: profile.phone,
      role: profile.role,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    });
    setLoading(false);
  }

  return {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
  };
}
