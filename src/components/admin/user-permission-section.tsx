// joy: 회원 상세의 권한 관리 섹션 (super_admin 전용)
// - role 변경 (user/admin/super_admin)
// - admin_roles 부여/해제
// - 본인 강등 차단, 2/2 상태 승격 차단
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PermissionGate } from '@/components/permission-gate';

type Role = 'user' | 'admin' | 'super_admin';

interface AdminRole {
  id: string;
  name: string;
  description: string | null;
}

interface Props {
  userId: string;
}

function Inner({ userId }: Props) {
  const { user: me } = useAuth();
  const supabase = createClient();

  const [targetRole, setTargetRole] = useState<Role>('user');
  const [allRoles, setAllRoles] = useState<AdminRole[]>([]);
  const [assignedRoleIds, setAssignedRoleIds] = useState<Set<string>>(new Set());
  const [superAdminCount, setSuperAdminCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalSelected, setModalSelected] = useState<Set<string>>(new Set());

  const isSelf = me?.id === userId;

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function load() {
    setLoading(true);
    try {
      const [profileRes, rolesRes, userRolesRes, superCountRes] = await Promise.all([
        supabase.from('users').select('role').eq('id', userId).maybeSingle(),
        supabase.from('admin_roles').select('id, name, description').order('name'),
        supabase.from('admin_user_roles').select('role_id').eq('user_id', userId),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'super_admin'),
      ]);

      setTargetRole((profileRes.data?.role as Role) ?? 'user');
      setAllRoles((rolesRes.data as AdminRole[]) ?? []);
      setAssignedRoleIds(new Set((userRolesRes.data ?? []).map((r) => r.role_id)));
      setSuperAdminCount(superCountRes.count ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : '로드 실패');
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(newRole: Role) {
    setError('');
    if (isSelf) {
      alert('본인의 역할은 변경할 수 없습니다.');
      return;
    }
    if (newRole === 'super_admin' && targetRole !== 'super_admin' && superAdminCount >= 2) {
      alert('super_admin은 최대 2명까지만 가능합니다. 기존 계정을 먼저 강등하세요.');
      return;
    }
    if (!confirm(`역할을 "${newRole}"(으)로 변경하시겠습니까?`)) return;

    setSaving(true);
    const { error: e } = await supabase.from('users').update({ role: newRole }).eq('id', userId);
    if (e) {
      setError(e.message);
      setSaving(false);
      return;
    }
    // user로 강등되면 admin_user_roles 매핑 제거
    if (newRole === 'user') {
      await supabase.from('admin_user_roles').delete().eq('user_id', userId);
    }
    await load();
    setSaving(false);
  }

  function openRoleModal() {
    setModalSelected(new Set(assignedRoleIds));
    setModalOpen(true);
  }

  async function saveRoles() {
    setSaving(true);
    await supabase.from('admin_user_roles').delete().eq('user_id', userId);
    const rows = Array.from(modalSelected).map((roleId) => ({
      user_id: userId,
      role_id: roleId,
      assigned_by: me?.id ?? null,
    }));
    if (rows.length > 0) {
      const { error: e } = await supabase.from('admin_user_roles').insert(rows);
      if (e) setError(e.message);
    }
    setModalOpen(false);
    await load();
    setSaving(false);
  }

  if (loading) return null;

  const isAdminOrAbove = targetRole === 'admin' || targetRole === 'super_admin';

  return (
    <Card className="p-6">
      <h3 className="mb-4 text-lg font-bold">권한 관리</h3>

      {error && <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* role 변경 */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-gray-600">현재 역할</span>
        <Badge
          variant={targetRole === 'super_admin' ? 'default' : targetRole === 'admin' ? 'default' : 'outline'}
          className={targetRole === 'super_admin' ? 'bg-purple-600' : ''}
        >
          {targetRole}
        </Badge>
        {!isSelf && (
          <select
            className="ml-auto flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={targetRole}
            onChange={(e) => handleRoleChange(e.target.value as Role)}
            disabled={saving}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
            <option value="super_admin" disabled={targetRole !== 'super_admin' && superAdminCount >= 2}>
              super_admin {superAdminCount >= 2 && targetRole !== 'super_admin' ? '(2/2 초과)' : ''}
            </option>
          </select>
        )}
        {isSelf && <span className="ml-auto text-xs text-gray-400">본인 계정</span>}
      </div>

      {/* admin_roles 부여 */}
      {isAdminOrAbove && targetRole !== 'super_admin' && (
        <div className="border-t pt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">부여된 역할</span>
            <Button size="sm" variant="outline" onClick={openRoleModal}>
              역할 편집
            </Button>
          </div>
          {assignedRoleIds.size === 0 ? (
            <p className="text-xs text-gray-400">부여된 역할이 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {Array.from(assignedRoleIds)
                .map((id) => allRoles.find((r) => r.id === id))
                .filter(Boolean)
                .map((r) => (
                  <Badge key={r!.id} variant="outline" className="text-xs">
                    {r!.name}
                  </Badge>
                ))}
            </div>
          )}
        </div>
      )}

      {targetRole === 'super_admin' && (
        <div className="border-t pt-4 text-xs text-gray-500">super_admin은 모든 권한을 가집니다.</div>
      )}

      {/* 역할 선택 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-md p-6">
            <h3 className="mb-4 text-lg font-bold">역할 편집</h3>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {allRoles.length === 0 && (
                <p className="text-sm text-gray-500">
                  먼저 역할 관리 페이지에서 역할을 생성하세요.
                </p>
              )}
              {allRoles.map((r) => (
                <label key={r.id} className="flex items-start gap-2 rounded-md border p-2 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={modalSelected.has(r.id)}
                    onChange={() => {
                      const next = new Set(modalSelected);
                      if (next.has(r.id)) next.delete(r.id);
                      else next.add(r.id);
                      setModalSelected(next);
                    }}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium">{r.name}</div>
                    {r.description && <div className="text-xs text-gray-500">{r.description}</div>}
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>취소</Button>
              <Button onClick={saveRoles} disabled={saving}>저장</Button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
}

export function UserPermissionSection({ userId }: Props) {
  return (
    <PermissionGate superAdminOnly>
      <Inner userId={userId} />
    </PermissionGate>
  );
}
