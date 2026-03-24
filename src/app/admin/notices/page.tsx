import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { Plus, Pin, Trash2, Edit } from 'lucide-react';

interface Notice {
  id: string;
  title: string;
  isPinned: boolean;
  viewCount: number;
  createdAt: string;
}

export default function AdminNoticesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadNotices();
    }
  }, [user, authLoading, navigate]);

  async function loadNotices() {
    try {
      setLoading(true);
      const response = await fetch('/api/notices?limit=100');
      const data = await response.json();
      if (data.success) {
        setNotices(data.data || []);
      } else {
        setError(data.error || '공지사항을 불러오지 못했습니다.');
      }
    } catch {
      setError('공지사항을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleTogglePin(noticeId: string, currentPinned: boolean) {
    try {
      const response = await fetch(`/api/admin/notices/${noticeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !currentPinned }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      await loadNotices();
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    }
  }

  async function handleDelete(noticeId: string) {
    if (!confirm('공지사항을 삭제하시겠습니까?')) return;
    try {
      const response = await fetch(`/api/admin/notices/${noticeId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      await loadNotices();
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.');
    }
  }

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">공지사항 관리</h1>
        <Link to="/admin/notices/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            공지 작성
          </Button>
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-500">로딩 중...</div>
      ) : notices.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="mb-4 text-gray-500">등록된 공지사항이 없습니다.</p>
          <Link to="/admin/notices/new">
            <Button>첫 공지 작성하기</Button>
          </Link>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">제목</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">상태</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">조회수</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">작성일</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {notices.map((notice) => (
                  <tr key={notice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {notice.isPinned && (
                          <Pin className="h-3.5 w-3.5 text-blue-500" />
                        )}
                        <span className="font-medium">{notice.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {notice.isPinned && (
                        <Badge variant="default">고정</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {(notice.viewCount || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {notice.createdAt
                        ? format(new Date(notice.createdAt), 'yyyy.MM.dd')
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        <Button
                          size="sm"
                          variant={notice.isPinned ? 'default' : 'outline'}
                          onClick={() => handleTogglePin(notice.id, notice.isPinned)}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </Button>
                        <Link to={`/admin/notices/${notice.id}/edit`}>
                          <Button size="sm" variant="outline">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(notice.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
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
