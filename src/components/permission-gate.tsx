// joy: 권한 기반 조건부 렌더링 / 라우트 가드 공통 컴포넌트
import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermission } from '@/hooks/usePermission';

interface GateProps {
  permission?: string;
  superAdminOnly?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * 인라인 조건부 렌더링: 권한이 없으면 children 대신 fallback(기본 null) 표시.
 */
export function PermissionGate({ permission, superAdminOnly, children, fallback = null }: GateProps) {
  const { isSuperAdmin } = useAuth();
  const has = usePermission(permission ?? '');

  if (superAdminOnly) return isSuperAdmin ? <>{children}</> : <>{fallback}</>;
  if (permission && !has && !isSuperAdmin) return <>{fallback}</>;
  return <>{children}</>;
}

interface RequireProps {
  permission?: string;
  superAdminOnly?: boolean;
  children: ReactNode;
}

/**
 * 페이지 단위 가드: 권한이 없으면 /admin 으로 리다이렉트.
 */
export function RequirePermission({ permission, superAdminOnly, children }: RequireProps) {
  const navigate = useNavigate();
  const { loading, user, isSuperAdmin } = useAuth();
  const has = usePermission(permission ?? '');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/auth/login');
      return;
    }
    if (superAdminOnly && !isSuperAdmin) {
      navigate('/admin');
      return;
    }
    if (permission && !has && !isSuperAdmin) {
      navigate('/admin');
    }
  }, [loading, user, isSuperAdmin, has, permission, superAdminOnly, navigate]);

  if (loading) return <div className="p-8">로딩 중...</div>;
  if (!user) return null;
  if (superAdminOnly && !isSuperAdmin) return null;
  if (permission && !has && !isSuperAdmin) return null;
  return <>{children}</>;
}
