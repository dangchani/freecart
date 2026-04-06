import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { Search, Plus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

function createAdminClient() {
  return createSupabaseClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  level: string;
  points: number;
  createdAt: string;
  isBlocked: boolean;
}

interface UserLevel {
  id: string;
  name: string;
}

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [userLevels, setUserLevels] = useState<UserLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');

  // 회원 추가 모달
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    loadUserLevels();
    loadUsers();
  }, []);

  async function loadUserLevels() {
    const supabase = createClient();
    const { data } = await supabase.from('user_levels').select('id, name').order('level');
    setUserLevels(data?.map((l: any) => ({ id: l.id, name: l.name })) || []);
  }

  async function loadUsers() {
    try {
      setLoading(true);
      const supabase = createAdminClient();

      let query = supabase
        .from('users')
        .select('id, name, email, phone, points, is_blocked, created_at, level_id, user_levels(name)')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      if (levelFilter) {
        query = query.eq('level_id', levelFilter);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      setUsers(
        (data || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone || '',
          level: (u.user_levels as any)?.name || '',
          points: u.points || 0,
          createdAt: u.created_at,
          isBlocked: u.is_blocked,
        }))
      );
    } catch {
      setError('회원 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleBlock(userId: string, currentlyBlocked: boolean) {
    const action = currentlyBlocked ? '차단 해제' : '차단';
    if (!confirm(`해당 회원을 ${action}하시겠습니까?`)) return;
    try {
      const supabase = createAdminClient();
      await supabase.from('users').update({ is_blocked: !currentlyBlocked }).eq('id', userId);
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (addForm.password.length < 8) {
      setAddError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    setAddSubmitting(true);
    setAddError('');
    try {
      const adminSupabase = createAdminClient();
      const { error } = await adminSupabase.rpc('admin_create_user', {
        p_email: addForm.email,
        p_password: addForm.password,
        p_name: addForm.name,
        p_phone: addForm.phone || null,
      });
      if (error) throw error;
      alert(`${addForm.name}(${addForm.email}) 회원이 생성되었습니다.`);
      setAddForm({ name: '', email: '', password: '', phone: '' });
      setShowAddModal(false);
      await loadUsers();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : '회원 생성 중 오류가 발생했습니다.');
    } finally {
      setAddSubmitting(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadUsers();
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">회원 관리</h1>
          <p className="text-sm text-gray-500 mt-1">총 {users.length}명</p>
        </div>
        <Button onClick={() => { setShowAddModal(true); setAddError(''); }}>
          <Plus className="mr-2 h-4 w-4" />
          회원 추가
        </Button>
      </div>

      {/* 검색/필터 */}
      <Card className="mb-6 p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="이름, 이메일, 전화번호 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border px-4 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 등급</option>
            {userLevels.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <Button type="submit">검색</Button>
        </form>
      </Card>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-gray-200 animate-pulse rounded" />)}
        </div>
      ) : users.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500 mb-3">회원이 없습니다.</p>
          <Button onClick={() => setShowAddModal(true)}><Plus className="mr-2 h-4 w-4" />첫 회원 추가</Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">이름</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">이메일</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">전화번호</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">등급</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">포인트</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">가입일</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">상태</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                  >
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3 text-gray-600">{u.phone || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{u.level || '-'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">{(u.points || 0).toLocaleString()}P</td>
                    <td className="px-4 py-3 text-gray-600">
                      {u.createdAt ? format(new Date(u.createdAt), 'yyyy.MM.dd') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.isBlocked ? 'destructive' : 'default'}>
                        {u.isBlocked ? '차단됨' : '정상'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant={u.isBlocked ? 'outline' : 'destructive'}
                        onClick={() => handleToggleBlock(u.id, u.isBlocked)}
                      >
                        {u.isBlocked ? '차단 해제' : '차단'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 회원 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">회원 추가</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <Label htmlFor="add-name">이름 *</Label>
                <Input
                  id="add-name"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="홍길동"
                  required
                />
              </div>
              <div>
                <Label htmlFor="add-email">이메일 *</Label>
                <Input
                  id="add-email"
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="add-password">초기 비밀번호 * (8자 이상)</Label>
                <Input
                  id="add-password"
                  type="password"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  placeholder="8자 이상"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <Label htmlFor="add-phone">전화번호</Label>
                <Input
                  id="add-phone"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="01012345678"
                />
              </div>

              {addError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{addError}</p>
              )}

              <p className="text-xs text-gray-400">
                * 회원이 즉시 생성되며 별도 이메일 인증 없이 바로 로그인 가능합니다.
              </p>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={addSubmitting} className="flex-1">
                  {addSubmitting ? '생성 중...' : '회원 생성'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                  취소
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
