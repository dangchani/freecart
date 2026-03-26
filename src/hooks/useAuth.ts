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
      // 프로필 조회 실패해도 인증 정보로 fallback
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || '',
          phone: null,
          role: 'user',
          createdAt: authUser.created_at,
          updatedAt: authUser.created_at,
        });
      }
      setLoading(false);
      return;
    }

    // 프로필이 없으면 auth 정보로 fallback
    if (!profile) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || '',
          phone: null,
          role: 'user',
          createdAt: authUser.created_at,
          updatedAt: authUser.created_at,
        });
      }
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
