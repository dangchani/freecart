// joy: 시스템 설정은 기본 설정으로 통합됨
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { RequirePermission } from '@/components/permission-gate';

function SystemSettingsInner() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/admin/settings', { replace: true });
  }, [navigate]);

  return null;
}

export default function SystemSettingsPage() {
  return (
    <RequirePermission superAdminOnly>
      <SystemSettingsInner />
    </RequirePermission>
  );
}
