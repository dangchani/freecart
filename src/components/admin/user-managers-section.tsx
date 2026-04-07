// joy: 사용자 상세 페이지에 끼워넣을 담당자 관리 섹션.
// super_admin만 편집 가능. 사용자 상세 페이지에서 <UserManagersSection userId={id} /> 로 사용.
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AdminOption {
  id: string;
  name: string;
  email: string;
}

interface Props {
  userId: string;
}

export function UserManagersSection({ userId }: Props) {
  const { user, isSuperAdmin } = useAuth();
  const supabase = createClient();

  const [assigned, setAssigned] = useState<AdminOption[]>([]);
  const [allAdmins, setAllAdmins] = useState<AdminOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function load() {
    setLoading(true);
    const [{ data: mgr }, { data: adminList }] = await Promise.all([
      supabase.from('user_managers').select('manager_user_id').eq('user_id', userId),
      supabase.from('users').select('id, name, email').in('role', ['admin', 'super_admin']).order('name'),
    ]);
    const managerIds = new Set((mgr ?? []).map((r) => r.manager_user_id));
    const all = (adminList as AdminOption[]) ?? [];
    setAllAdmins(all);
    setAssigned(all.filter((a) => managerIds.has(a.id)));
    setLoading(false);
  }

  function openModal() {
    setSelected(new Set(assigned.map((a) => a.id)));
    setModalOpen(true);
  }

  async function save() {
    // 단순 방식: 기존 매핑 삭제 후 재삽입
    await supabase.from('user_managers').delete().eq('user_id', userId);
    const rows = Array.from(selected).map((mid) => ({
      user_id: userId,
      manager_user_id: mid,
      assigned_by: user?.id ?? null,
    }));
    if (rows.length > 0) await supabase.from('user_managers').insert(rows);
    setModalOpen(false);
    await load();
  }

  if (loading) return null;

  return (
    <Card className="p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold">담당 관리자</h3>
        {isSuperAdmin && (
          <Button size="sm" variant="outline" onClick={openModal}>
            담당자 변경
          </Button>
        )}
      </div>

      {assigned.length === 0 ? (
        <p className="text-sm text-gray-500">배정된 담당자가 없습니다.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {assigned.map((a) => (
            <Badge key={a.id} variant="outline">
              {a.name || a.email}
            </Badge>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-md p-6">
            <h3 className="mb-4 text-lg font-bold">담당자 선택</h3>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {allAdmins.map((a) => (
                <label key={a.id} className="flex items-start gap-2 rounded-md border p-2 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={() => {
                      const next = new Set(selected);
                      if (next.has(a.id)) next.delete(a.id);
                      else next.add(a.id);
                      setSelected(next);
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
              <Button variant="outline" onClick={() => setModalOpen(false)}>취소</Button>
              <Button onClick={save}>저장</Button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
}
