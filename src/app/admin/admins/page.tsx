// joy: 관리자 계정 관리 - 역할 부여/해제, 수퍼관리자 표시, 역할 배지
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { RequirePermission } from '@/components/permission-gate';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'super_admin';
  last_login_at: string | null;
  created_at: string;
  roleIds: string[];
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

function AdminsInner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const supabase = createClient();

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add admin form
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Role assignment modal
  const [modalAdmin, setModalAdmin] = useState<AdminUser | null>(null);
  const [modalSelected, setModalSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const [{ data: adminRows }, { data: rolesData }, { data: userRoleRows }] = await Promise.all([
        supabase
          .from('users')
          .select('id, name, email, role, last_login_at, created_at')
          .in('role', ['admin', 'super_admin'])
          .order('created_at', { ascending: false }),
        supabase.from('admin_roles').select('id, name, description').order('name'),
        supabase.from('admin_user_roles').select('user_id, role_id'),
      ]);

      const roleMap = new Map<string, string[]>();
      for (const r of userRoleRows ?? []) {
        if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
        roleMap.get(r.user_id)!.push(r.role_id);
      }

      setAdmins(
        (adminRows ?? []).map((u) => ({
          id: u.id,
          name: u.name || '',
          email: u.email,
          role: u.role as 'admin' | 'super_admin',
          last_login_at: u.last_login_at,
          created_at: u.created_at,
          roleIds: roleMap.get(u.id) ?? [],
        }))
      );
      setRoles((rolesData as Role[]) ?? []);
    } catch {
      setError('관리자 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSearching(true);
    setSearchError('');
    try {
      const { data: foundUser, error: findError } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('email', email.trim())
        .maybeSingle();
      if (findError) throw findError;
      if (!foundUser) {
        setSearchError('해당 이메일의 회원을 찾을 수 없습니다.');
        return;
      }
      if (foundUser.role === 'admin' || foundUser.role === 'super_admin') {
        setSearchError('이미 관리자 권한이 부여된 회원입니다.');
        return;
      }
      if (!confirm(`${foundUser.name || foundUser.email} 회원에게 관리자 권한을 부여하시겠습니까?`)) return;
      const { error: updateError } = await supabase.from('users').update({ role: 'admin' }).eq('id', foundUser.id);
      if (updateError) throw updateError;
      alert('관리자 권한이 부여되었습니다.');
      setEmail('');
      await loadAll();
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setSearching(false);
    }
  }

  // joy: admin → super_admin 승격 (최대 2명 제한은 DB 트리거가 강제)
  async function handlePromoteToSuper(admin: AdminUser) {
    const superCount = admins.filter((a) => a.role === 'super_admin').length;
    if (superCount >= 2) {
      alert('super_admin은 최대 2명까지만 생성할 수 있습니다.');
      return;
    }
    if (!confirm(`${admin.name || admin.email} 계정을 super_admin으로 승격하시겠습니까?`)) return;
    const { error: e } = await supabase.from('users').update({ role: 'super_admin' }).eq('id', admin.id);
    if (e) return alert(e.message);
    await loadAll();
  }

  async function handleRevokeAdmin(admin: AdminUser) {
    if (user?.id === admin.id) return alert('본인의 관리자 권한은 해제할 수 없습니다.');
    if (admin.role === 'super_admin') {
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'super_admin');
      if ((count ?? 0) <= 1) return alert('마지막 super_admin 계정은 강등할 수 없습니다.');
    }
    if (!confirm(`${admin.name || admin.email} 회원의 관리자 권한을 해제하시겠습니까?`)) return;
    try {
      const { error: updateError } = await supabase.from('users').update({ role: 'user' }).eq('id', admin.id);
      if (updateError) throw updateError;
      await supabase.from('admin_user_roles').delete().eq('user_id', admin.id);
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : '권한 해제 중 오류가 발생했습니다.');
    }
  }

  function openRoleModal(admin: AdminUser) {
    setModalAdmin(admin);
    setModalSelected(new Set(admin.roleIds));
  }

  async function saveRoles() {
    if (!modalAdmin) return;
    await supabase.from('admin_user_roles').delete().eq('user_id', modalAdmin.id);
    const rows = Array.from(modalSelected).map((roleId) => ({
      user_id: modalAdmin.id,
      role_id: roleId,
      assigned_by: user?.id ?? null,
    }));
    if (rows.length > 0) await supabase.from('admin_user_roles').insert(rows);
    setModalAdmin(null);
    await loadAll();
  }

  if (loading) return <div className="p-8">로딩 중...</div>;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">관리자 계정 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          총 {admins.length}명의 관리자 · super_admin {admins.filter((a) => a.role === 'super_admin').length}/2
        </p>
        {admins.filter((a) => a.role === 'super_admin').length < 2 && (
          <div className="mt-3 rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
            ⚠️ super_admin 계정이 {admins.filter((a) => a.role === 'super_admin').length}명입니다. 운영 안정성을 위해 2명 등록을 권장합니다.
          </div>
        )}
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

      <Card className="mb-6 p-6">
        <h2 className="mb-4 text-lg font-bold">관리자 추가</h2>
        <form onSubmit={handleAddAdmin} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-64">
            <Label htmlFor="admin-email">회원 이메일</Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={searching}>
            {searching ? '검색 중...' : '관리자 권한 부여'}
          </Button>
        </form>
        {searchError && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{searchError}</p>}
      </Card>

      {admins.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">등록된 관리자가 없습니다.</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">이름</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">이메일</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">역할</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">마지막 로그인</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">가입일</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {admin.name || '-'}
                      {user?.id === admin.id && <Badge variant="secondary" className="ml-2">나</Badge>}
                      {admin.role === 'super_admin' && (
                        <Badge variant="default" className="ml-2 bg-purple-600">super_admin</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{admin.email}</td>
                    <td className="px-4 py-3">
                      {admin.role === 'super_admin' ? (
                        <span className="text-xs text-gray-500">(모든 권한)</span>
                      ) : admin.roleIds.length === 0 ? (
                        <span className="text-xs text-gray-400">역할 없음</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {admin.roleIds
                            .map((id) => roles.find((r) => r.id === id)?.name)
                            .filter(Boolean)
                            .map((name) => (
                              <Badge key={name} variant="outline" className="text-xs">
                                {name}
                              </Badge>
                            ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {admin.last_login_at ? format(new Date(admin.last_login_at), 'yyyy.MM.dd HH:mm') : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {admin.created_at ? format(new Date(admin.created_at), 'yyyy.MM.dd') : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        {admin.role !== 'super_admin' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openRoleModal(admin)}>
                              역할
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={admins.filter((a) => a.role === 'super_admin').length >= 2}
                              onClick={() => handlePromoteToSuper(admin)}
                              title={
                                admins.filter((a) => a.role === 'super_admin').length >= 2
                                  ? 'super_admin은 최대 2명까지만 가능합니다'
                                  : '최고 관리자로 승격'
                              }
                            >
                              승격
                            </Button>
                          </>
                        )}
                        {user?.id !== admin.id && (
                          <Button size="sm" variant="destructive" onClick={() => handleRevokeAdmin(admin)}>
                            해제
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Role assignment modal */}
      {modalAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-md p-6">
            <h3 className="mb-1 text-lg font-bold">역할 부여</h3>
            <p className="mb-4 text-sm text-gray-500">{modalAdmin.name || modalAdmin.email}</p>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {roles.length === 0 && (
                <p className="text-sm text-gray-500">
                  먼저 <button className="text-blue-600 underline" onClick={() => navigate('/admin/settings/roles')}>역할 관리 페이지</button>에서 역할을 생성하세요.
                </p>
              )}
              {roles.map((r) => (
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
              <Button variant="outline" onClick={() => setModalAdmin(null)}>취소</Button>
              <Button onClick={saveRoles}>저장</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function AdminAccountsPage() {
  return (
    <RequirePermission superAdminOnly>
      <AdminsInner />
    </RequirePermission>
  );
}
