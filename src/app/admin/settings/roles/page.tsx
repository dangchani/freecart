// joy: 역할(admin_roles) CRUD + 권한(permissions) 체크박스 매트릭스 관리 페이지
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { RequirePermission } from '@/components/permission-gate';

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

interface Permission {
  permission_key: string;
  module: string;
  action: string;
  description: string | null;
  is_super_admin_only: boolean;
}

function RolesInner() {
  const supabase = createClient();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Create role form
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedRoleId) loadRolePermissions(selectedRoleId);
    else setSelectedKeys(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoleId]);

  async function load() {
    setLoading(true);
    const [{ data: rolesData }, { data: permsData }] = await Promise.all([
      supabase.from('admin_roles').select('*').order('is_system', { ascending: false }).order('created_at'),
      supabase.from('permissions').select('*').order('module').order('action'),
    ]);
    setRoles((rolesData as Role[]) ?? []);
    setPermissions((permsData as Permission[]) ?? []);
    setLoading(false);
  }

  async function loadRolePermissions(roleId: string) {
    const { data } = await supabase
      .from('admin_role_permissions')
      .select('permission_key')
      .eq('role_id', roleId);
    setSelectedKeys(new Set((data ?? []).map((r) => r.permission_key)));
  }

  async function createRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const { data, error: e1 } = await supabase
      .from('admin_roles')
      .insert({ name: newName.trim(), description: newDesc.trim() || null })
      .select()
      .single();
    if (e1) {
      setError(e1.message);
      return;
    }
    setNewName('');
    setNewDesc('');
    await load();
    setSelectedRoleId((data as Role).id);
  }

  async function deleteRole(role: Role) {
    if (role.is_system) return alert('시스템 기본 역할은 삭제할 수 없습니다.');
    if (!confirm(`"${role.name}" 역할을 삭제하시겠습니까? 이 역할을 부여받은 관리자의 권한도 함께 해제됩니다.`)) return;
    const { error: e } = await supabase.from('admin_roles').delete().eq('id', role.id);
    if (e) return setError(e.message);
    if (selectedRoleId === role.id) setSelectedRoleId(null);
    await load();
  }

  async function savePermissions() {
    if (!selectedRoleId) return;
    setSaving(true);
    // 단순한 방식: 기존 매핑 전체 삭제 후 재삽입
    await supabase.from('admin_role_permissions').delete().eq('role_id', selectedRoleId);
    const keys = Array.from(selectedKeys);
    if (keys.length > 0) {
      const rows = keys.map((k) => ({ role_id: selectedRoleId, permission_key: k }));
      const { error: e } = await supabase.from('admin_role_permissions').insert(rows);
      if (e) setError(e.message);
    }
    setSaving(false);
    alert('권한이 저장되었습니다.');
  }

  function toggleKey(key: string) {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedKeys(next);
  }

  const grouped = useMemo(() => {
    const m = new Map<string, Permission[]>();
    for (const p of permissions) {
      if (!m.has(p.module)) m.set(p.module, []);
      m.get(p.module)!.push(p);
    }
    return Array.from(m.entries());
  }, [permissions]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  if (loading) return <div className="p-8">로딩 중...</div>;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">역할 관리</h1>
        <p className="mt-1 text-sm text-gray-500">역할을 만들고 권한을 부여한 뒤, 관리자 계정에 할당하세요.</p>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 역할 목록 */}
        <Card className="p-4 lg:col-span-1">
          <h2 className="mb-3 text-lg font-bold">역할 목록</h2>
          <ul className="space-y-1">
            {roles.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setSelectedRoleId(r.id)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    selectedRoleId === r.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{r.name}</span>
                    {r.is_system && <span className="text-xs text-gray-400">시스템</span>}
                  </div>
                  {r.description && <div className="mt-0.5 text-xs text-gray-500">{r.description}</div>}
                </button>
              </li>
            ))}
            {roles.length === 0 && <li className="px-3 py-4 text-sm text-gray-500">등록된 역할이 없습니다.</li>}
          </ul>

          <form onSubmit={createRole} className="mt-4 space-y-2 border-t pt-4">
            <Label>새 역할 추가</Label>
            <Input placeholder="역할 이름" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="설명 (선택)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            <Button type="submit" size="sm" className="w-full">추가</Button>
          </form>

          {selectedRole && !selectedRole.is_system && (
            <Button variant="destructive" size="sm" className="mt-3 w-full" onClick={() => deleteRole(selectedRole)}>
              선택 역할 삭제
            </Button>
          )}
        </Card>

        {/* 권한 매트릭스 */}
        <Card className="p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">
              권한 설정 {selectedRole && <span className="text-gray-500">— {selectedRole.name}</span>}
            </h2>
            {selectedRoleId && (
              <Button onClick={savePermissions} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </Button>
            )}
          </div>

          {!selectedRoleId ? (
            <div className="py-12 text-center text-gray-500">좌측에서 역할을 선택하세요.</div>
          ) : (
            <div className="space-y-5">
              {grouped.map(([module, perms]) => (
                <div key={module}>
                  <div className="mb-2 text-sm font-semibold text-gray-700">{module}</div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {perms.map((p) => {
                      const disabled = p.is_super_admin_only;
                      return (
                        <label
                          key={p.permission_key}
                          className={`flex items-start gap-2 rounded-md border p-2 text-sm ${
                            disabled ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={disabled}
                            checked={selectedKeys.has(p.permission_key)}
                            onChange={() => toggleKey(p.permission_key)}
                            className="mt-0.5"
                          />
                          <div>
                            <div className="font-mono text-xs">{p.permission_key}</div>
                            <div className="text-xs text-gray-500">
                              {p.description}
                              {disabled && ' (super_admin 전용)'}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function RolesPage() {
  return (
    <RequirePermission superAdminOnly>
      <RolesInner />
    </RequirePermission>
  );
}
