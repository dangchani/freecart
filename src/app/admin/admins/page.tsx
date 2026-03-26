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

interface AdminUser {
  id: string;
  name: string;
  email: string;
  last_login_at: string | null;
  created_at: string;
}

export default function AdminAccountsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add admin form
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadAdmins();
    }
  }, [user, authLoading, navigate]);

  async function loadAdmins() {
    try {
      setLoading(true);
      const supabase = createClient();

      const { data, error: fetchError } = await supabase
        .from('users')
        .select('id, name, email, last_login_at, created_at')
        .eq('role', 'admin')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setAdmins(
        (data || []).map((u) => ({
          id: u.id,
          name: u.name || '',
          email: u.email,
          last_login_at: u.last_login_at,
          created_at: u.created_at,
        }))
      );
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
      const supabase = createClient();

      // Search user by email
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

      if (foundUser.role === 'admin') {
        setSearchError('이미 관리자 권한이 부여된 회원입니다.');
        return;
      }

      if (!confirm(`${foundUser.name || foundUser.email} 회원에게 관리자 권한을 부여하시겠습니까?`)) {
        return;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'admin' })
        .eq('id', foundUser.id);

      if (updateError) throw updateError;

      alert(`${foundUser.name || foundUser.email} 회원에게 관리자 권한이 부여되었습니다.`);
      setEmail('');
      await loadAdmins();
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : '관리자 추가 중 오류가 발생했습니다.');
    } finally {
      setSearching(false);
    }
  }

  async function handleRevokeAdmin(admin: AdminUser) {
    if (user?.id === admin.id) {
      alert('본인의 관리자 권한은 해제할 수 없습니다.');
      return;
    }

    if (!confirm(`${admin.name || admin.email} 회원의 관리자 권한을 해제하시겠습니까?`)) {
      return;
    }

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'user' })
        .eq('id', admin.id);

      if (updateError) throw updateError;

      alert(`${admin.name || admin.email} 회원의 관리자 권한이 해제되었습니다.`);
      await loadAdmins();
    } catch (err) {
      alert(err instanceof Error ? err.message : '권한 해제 중 오류가 발생했습니다.');
    }
  }

  if (authLoading || loading) return <div className="p-8">로딩 중...</div>;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">관리자 계정 관리</h1>
        <p className="mt-1 text-sm text-gray-500">총 {admins.length}명의 관리자</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {/* Add Admin Form */}
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
        {searchError && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {searchError}
          </p>
        )}
      </Card>

      {/* Admin List */}
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
                      {user?.id === admin.id && (
                        <Badge variant="secondary" className="ml-2">나</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{admin.email}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {admin.last_login_at
                        ? format(new Date(admin.last_login_at), 'yyyy.MM.dd HH:mm')
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {admin.created_at
                        ? format(new Date(admin.created_at), 'yyyy.MM.dd')
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user?.id === admin.id ? (
                        <span className="text-xs text-gray-400">해제 불가</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRevokeAdmin(admin)}
                        >
                          권한 해제
                        </Button>
                      )}
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
