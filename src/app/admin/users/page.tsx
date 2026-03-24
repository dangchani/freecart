import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { Search } from 'lucide-react';

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

const levelOptions = [
  { value: '', label: '전체 등급' },
  { value: 'bronze', label: '브론즈' },
  { value: 'silver', label: '실버' },
  { value: 'gold', label: '골드' },
  { value: 'vip', label: 'VIP' },
];

const levelLabels: Record<string, string> = {
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  vip: 'VIP',
};

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadUsers();
    }
  }, [user, authLoading, navigate]);

  async function loadUsers() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (levelFilter) params.set('level', levelFilter);

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setUsers(data.data || []);
      } else {
        setError(data.error || '회원 목록을 불러오지 못했습니다.');
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
      const response = await fetch(`/api/admin/users/${userId}/block`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked: !currentlyBlocked }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadUsers();
  }

  if (authLoading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-3xl font-bold">회원 관리</h1>

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
            {levelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button type="submit">검색</Button>
        </form>
      </Card>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-500">로딩 중...</div>
      ) : users.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">회원이 없습니다.</p>
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
                      <Badge variant="outline">{levelLabels[u.level] || u.level}</Badge>
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
                    <td
                      className="px-4 py-3 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
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
    </div>
  );
}
