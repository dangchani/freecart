// joy: 권한/설정 헬퍼. DB 함수(has_permission, can_manage_user) 호출 래퍼와
// 시스템 설정(system_settings) 조회, 내 권한 목록 일괄 로드.
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

/**
 * 시스템 설정 값 조회 (system_settings 테이블)
 * 예: getSystemSetting<boolean>('require_signup_approval')
 */
export async function getSystemSetting<T = unknown>(key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error || !data) return null;
  return data.value as T;
}

/**
 * 현재 로그인 사용자의 모든 권한 키 목록을 한 번에 조회.
 * super_admin이면 ['*'] 반환 (모든 권한 인정).
 */
export async function getMyPermissions(): Promise<string[]> {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return [];

  // role 확인 — super_admin은 와일드카드
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', authUser.id)
    .maybeSingle();

  if (!profile) return [];
  if (profile.role === 'super_admin') return ['*'];

  // admin이면 역할에 매핑된 권한 키 조회 (2단계)
  const { data: roleRows } = await supabase
    .from('admin_user_roles')
    .select('role_id')
    .eq('user_id', authUser.id);

  const roleIds = (roleRows ?? []).map(r => r.role_id);
  if (roleIds.length === 0) return [];

  const { data: permRows } = await supabase
    .from('admin_role_permissions')
    .select('permission_key')
    .in('role_id', roleIds);

  return Array.from(new Set((permRows ?? []).map(p => p.permission_key)));
}

/**
 * 단일 권한 보유 여부 (DB RPC 호출).
 * 캐시된 권한 배열로 검사하려면 hasPermissionInList 사용.
 */
export async function hasPermission(permissionKey: string): Promise<boolean> {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return false;

  const { data, error } = await supabase.rpc('has_permission', {
    uid: authUser.id,
    perm_key: permissionKey,
  });
  if (error) return false;
  return data === true;
}

/**
 * 캐시된 권한 배열에서 검사 (super_admin 와일드카드 지원).
 */
export function hasPermissionInList(permissions: string[] | undefined, key: string): boolean {
  if (!permissions || permissions.length === 0) return false;
  if (permissions.includes('*')) return true;
  return permissions.includes(key);
}

/**
 * 특정 사용자에 대한 관리 권한 (담당자 토글 자동 반영).
 */
export async function canManageUser(targetUserId: string): Promise<boolean> {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return false;

  const { data, error } = await supabase.rpc('can_manage_user', {
    uid: authUser.id,
    target_user_id: targetUserId,
  });
  if (error) return false;
  return data === true;
}
