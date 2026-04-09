/**
 * 폐쇄몰 접근 제어 가드
 *
 * scope='site'  → closed_mall_mode='full' 일 때만 차단 (메인부터)
 * scope='content' → 두 모드 모두 차단 (상품 상세/장바구니/주문)
 */
import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getSettings } from '@/services/settings';

interface Props {
  scope: 'site' | 'content';
}

interface PrivateMallConfig {
  enabled: boolean;
  mode: 'full' | 'product';
}

export function PrivateMallGuard({ scope }: Props) {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [config, setConfig] = useState<PrivateMallConfig | null>(null);

  useEffect(() => {
    getSettings(['closed_mall_enabled', 'closed_mall_mode']).then((s) => {
      setConfig({
        enabled: s.closed_mall_enabled === 'true',
        mode: (s.closed_mall_mode as 'full' | 'product') || 'product',
      });
    });
  }, []);

  // 설정 또는 인증 로딩 중
  if (!config || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // 폐쇄몰 비활성화 → 통과
  if (!config.enabled) return <Outlet />;

  // scope='site' 이고 mode='product'이면 메인 허용 → 통과
  if (scope === 'site' && config.mode !== 'full') return <Outlet />;

  // 관리자는 항상 통과
  if (user?.role === 'admin' || user?.role === 'super_admin') return <Outlet />;

  // 미로그인 → 로그인 페이지
  // full 모드(메인부터 차단)는 헤더/푸터 없는 전용 로그인 페이지로 이동
  if (!user) {
    const loginPath =
      scope === 'site' && config.mode === 'full'
        ? `/auth/closed-mall?next=${encodeURIComponent(location.pathname + location.search)}`
        : `/auth/login?reason=closed_mall&next=${encodeURIComponent(location.pathname + location.search)}`;
    return <Navigate to={loginPath} replace />;
  }

  // 로그인했지만 미승인 → 승인 대기 페이지
  if (user.isApproved === false) {
    return <Navigate to="/auth/pending-approval" replace />;
  }

  return <Outlet />;
}
