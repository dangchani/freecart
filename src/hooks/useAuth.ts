import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getMyPermissions, getSystemSetting } from '@/lib/permissions';
import type { User } from '@/types';

// joy: 승인 대기 사용자가 로그인 시도하면 강제 로그아웃하고 호출자에게 안내할 수 있도록 사용하는 마커
export const PENDING_APPROVAL_ERROR = 'PENDING_APPROVAL';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingApproval, setPendingApproval] = useState(false);
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
    } = supabase.auth.onAuthStateChange((event, session) => {
      // 세션 만료 시 강제 로그아웃 후 로그인 페이지로 이동
      if (event === 'TOKEN_REFRESHED' && !session) {
        supabase.auth.signOut().finally(() => {
          setUser(null);
          setPendingApproval(false);
          setLoading(false);
          window.location.href = '/auth/login?reason=session_expired';
        });
        return;
      }
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setUser(null);
        setPendingApproval(false);
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

    // joy: 승인 토글 ON + 일반 사용자 + 미승인이면 강제 로그아웃
    if (profile.role === 'user') {
      const requireApproval = await getSystemSetting<boolean>('require_signup_approval');
      if (requireApproval === true && profile.is_approved === false) {
        await supabase.auth.signOut();
        setUser(null);
        setPendingApproval(true);
        setLoading(false);
        return;
      }
    }

    // joy: 관리자 계정은 권한 목록을 함께 캐싱
    let permissions: string[] = [];
    if (profile.role === 'admin' || profile.role === 'super_admin') {
      try {
        permissions = await getMyPermissions();
      } catch (e) {
        console.error('[useAuth] Failed to load permissions:', e);
      }
    }

    setUser({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      phone: profile.phone,
      role: profile.role,
      isApproved: profile.is_approved,
      mustChangePassword: profile.must_change_password ?? false,
      permissions,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    });
    setPendingApproval(false);
    setLoading(false);
  }

  return {
    user,
    loading,
    pendingApproval,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
    isSuperAdmin: user?.role === 'super_admin',
    mustChangePassword: user?.mustChangePassword ?? false,
    permissions: user?.permissions ?? [],
  };
}
