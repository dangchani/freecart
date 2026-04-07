// joy: 캐싱된 권한 배열에서 단일 권한 보유 여부를 boolean으로 반환하는 훅.
// super_admin은 ['*']로 캐싱되어 항상 true.
import { useAuth } from './useAuth';
import { hasPermissionInList } from '@/lib/permissions';

export function usePermission(permissionKey: string): boolean {
  const { permissions, isSuperAdmin } = useAuth();
  if (isSuperAdmin) return true;
  return hasPermissionInList(permissions, permissionKey);
}
