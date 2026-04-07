// joy: 가입 승인 대기 페이지 - 미승인 사용자 목록, 승인 + (토글 ON시) 담당자 배정
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { RequirePermission } from '@/components/permission-gate';

interface PendingUser {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

interface AdminOption {
  id: string;
  name: string;
  email: string;
}

function PendingInner() {
  const { user } = useAuth();
  const supabase = createClient();

  const [users, setUsers] = useState<PendingUser[]>([]);
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [assignmentEnabled, setAssignmentEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [approveTarget, setApproveTarget] = useState<PendingUser | null>(null);
  const [selectedManagers, setSelectedManagers] = useState<Set<string>>(new Set());

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [{ data: pending }, { data: adminList }, { data: toggle }] = await Promise.all([
        supabase
          .from('users')
          .select('id, name, email, created_at')
          .eq('is_approved', false)
          .eq('role', 'user')
          .order('created_at', { ascending: false }),
        supabase
          .from('users')
          .select('id, name, email')
          .in('role', ['admin', 'super_admin'])
          .order('name'),
        supabase.from('system_settings').select('value').eq('key', 'enable_user_assignment').maybeSingle(),
      ]);
      setUsers((pending as PendingUser[]) ?? []);
      setAdmins((adminList as AdminOption[]) ?? []);
      setAssignmentEnabled(toggle?.value === true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '로드 실패');
    } finally {
      setLoading(false);
    }
  }

  function startApprove(u: PendingUser) {
    if (!assignmentEnabled) {
      // 바로 승인
      approve(u, []);
      return;
    }
    setApproveTarget(u);
    setSelectedManagers(new Set());
  }

  async function approve(u: PendingUser, managerIds: string[]) {
    const { error: e1 } = await supabase
      .from('users')
      .update({ is_approved: true, approved_at: new Date().toISOString(), approved_by: user?.id ?? null })
      .eq('id', u.id);
    if (e1) {
      alert(e1.message);
      return;
    }
    if (managerIds.length > 0) {
      const rows = managerIds.map((mid) => ({
        user_id: u.id,
        manager_user_id: mid,
        assigned_by: user?.id ?? null,
      }));
      const { error: e2 } = await supabase.from('user_managers').insert(rows);
      if (e2) alert(e2.message);
    }
    setApproveTarget(null);
    await load();
  }

  async function reject(u: PendingUser) {
    if (!confirm(`${u.name || u.email} 사용자의 가입을 거부하시겠습니까? 계정이 삭제됩니다.`)) return;
    const { error: e } = await supabase.from('users').delete().eq('id', u.id);
    if (e) alert(e.message);
    await load();
  }

  if (loading) return <div className="p-8">로딩 중...</div>;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">가입 승인 대기</h1>
        <p className="mt-1 text-sm text-gray-500">
          승인 대기 중인 사용자 {users.length}명
          {assignmentEnabled && <Badge className="ml-2" variant="default">담당자 기능 ON</Badge>}
        </p>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

      {users.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">승인 대기 중인 사용자가 없습니다.</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">이름</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">이메일</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">가입일</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{u.name || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {format(new Date(u.created_at), 'yyyy.MM.dd HH:mm')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <Button size="sm" onClick={() => startApprove(u)}>승인</Button>
                        <Button size="sm" variant="destructive" onClick={() => reject(u)}>거부</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 담당자 배정 모달 */}
      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-md p-6">
            <h3 className="mb-1 text-lg font-bold">담당자 배정 후 승인</h3>
            <p className="mb-4 text-sm text-gray-500">{approveTarget.name || approveTarget.email}</p>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {admins.length === 0 && <p className="text-sm text-gray-500">관리자가 없습니다.</p>}
              {admins.map((a) => (
                <label key={a.id} className="flex items-start gap-2 rounded-md border p-2 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedManagers.has(a.id)}
                    onChange={() => {
                      const next = new Set(selectedManagers);
                      if (next.has(a.id)) next.delete(a.id);
                      else next.add(a.id);
                      setSelectedManagers(next);
                    }}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-medium">{a.name || a.email}</div>
                    <div className="text-xs text-gray-500">{a.email}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setApproveTarget(null)}>취소</Button>
              <Button onClick={() => approve(approveTarget, Array.from(selectedManagers))}>
                승인 {selectedManagers.size > 0 && `(${selectedManagers.size}명 배정)`}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function PendingApprovalPage() {
  return (
    <RequirePermission permission="users.approve">
      <PendingInner />
    </RequirePermission>
  );
}
