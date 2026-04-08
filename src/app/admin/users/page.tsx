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
import { getSystemSetting } from '@/lib/permissions';
import { useAuth } from '@/hooks/useAuth';

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

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [myInfo, setMyInfo] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [useLevels, setUseLevels] = useState(true);
  const [usePoints, setUsePoints] = useState(true);
  const [pointLabel, setPointLabel] = useState('포인트');

  // 회원 추가 모달
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    (async () => {
      const [ul, up, pl] = await Promise.all([
        getSystemSetting<boolean>('use_user_levels'),
        getSystemSetting<boolean>('use_points'),
        getSystemSetting<string>('point_label'),
      ]);
      setUseLevels(ul !== false);
      setUsePoints(up !== false);
      if (typeof pl === 'string' && pl) setPointLabel(pl);
    })();
  }, []);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  async function loadUsers() {
    try {
      setLoading(true);
      const supabase = createClient();

      let query = supabase
        .from('users')
        .select('id, name, email, phone, points, is_blocked, created_at, level_id, user_levels(name)')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      const mapped: User[] = (data || []).map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || '',
        level: (u.user_levels as any)?.name || '',
        points: u.points || 0,
        createdAt: u.created_at,
        isBlocked: u.is_blocked,
      }));

      // 본인 레코드는 목록 상단 카드로 분리
      const myId = authUser?.id;
      if (myId) {
        const mine = mapped.find((u) => u.id === myId) ?? null;
        setMyInfo(mine);
        setUsers(mapped.filter((u) => u.id !== myId));
      } else {
        setMyInfo(null);
        setUsers(mapped);
      }
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
      const supabase = createClient();
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
      const adminSupabase = createClient();
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

      {/* 본인 정보 카드 */}
      {myInfo && (
        <Card
          className="mb-4 cursor-pointer p-5 transition-colors hover:bg-blue-50 border-blue-200"
          onClick={() => navigate(`/admin/users/${myInfo.id}`)}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">
                {myInfo.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">{myInfo.name}</span>
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200">내 계정</Badge>
                  <Badge variant={myInfo.isBlocked ? 'destructive' : 'default'}>
                    {myInfo.isBlocked ? '차단됨' : '정상'}
                  </Badge>
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  {myInfo.email}
                  {myInfo.phone && <span className="ml-2">· {myInfo.phone}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-600">
              {useLevels && (
                <div className="text-right">
                  <div className="text-xs text-gray-400">등급</div>
                  <div className="font-medium">{myInfo.level || '-'}</div>
                </div>
              )}
              {usePoints && (
                <div className="text-right">
                  <div className="text-xs text-gray-400">{pointLabel}</div>
                  <div className="font-medium">{(myInfo.points || 0).toLocaleString()}P</div>
                </div>
              )}
              <div className="text-right">
                <div className="text-xs text-gray-400">가입일</div>
                <div className="font-medium">
                  {myInfo.createdAt ? format(new Date(myInfo.createdAt), 'yyyy.MM.dd') : '-'}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

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
                  {useLevels && <th className="px-4 py-3 text-left font-medium text-gray-600">등급</th>}
                  {usePoints && <th className="px-4 py-3 text-right font-medium text-gray-600">{pointLabel}</th>}
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
                    {useLevels && (
                      <td className="px-4 py-3">
                        <Badge variant="outline">{u.level || '-'}</Badge>
                      </td>
                    )}
                    {usePoints && (
                      <td className="px-4 py-3 text-right">{(u.points || 0).toLocaleString()}P</td>
                    )}
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
