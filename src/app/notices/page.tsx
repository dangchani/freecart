import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pin, Eye } from 'lucide-react';
import { format } from 'date-fns';

interface Notice {
  id: string;
  title: string;
  isPinned: boolean;
  viewCount: number;
  createdAt: string;
}

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNotices();
  }, []);

  async function fetchNotices() {
    try {
      const res = await fetch('/api/notices');
      const json = await res.json();
      if (json.success) {
        // 고정 공지사항을 최상단에 정렬
        const sorted = (json.data || []).sort((a: Notice, b: Notice) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setNotices(sorted);
      } else {
        setError('공지사항을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      console.error('공지사항 로딩 실패:', err);
      setError('공지사항을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container py-8">
        <div className="p-8 text-center text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <h1 className="mb-8 text-3xl font-bold">공지사항</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {notices.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">등록된 공지사항이 없습니다.</p>
        </Card>
      ) : (
        <Card>
          <div className="divide-y">
            {notices.map((notice) => (
              <Link
                key={notice.id}
                to={`/notices/${notice.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {notice.isPinned && (
                    <Pin className="h-4 w-4 shrink-0 text-blue-500" fill="currentColor" />
                  )}
                  <span className={`truncate ${notice.isPinned ? 'font-semibold' : ''}`}>
                    {notice.title}
                  </span>
                  {notice.isPinned && (
                    <Badge variant="outline" className="shrink-0 text-xs text-blue-600 border-blue-300">
                      공지
                    </Badge>
                  )}
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-4 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {notice.viewCount.toLocaleString()}
                  </span>
                  <span>{format(new Date(notice.createdAt), 'yyyy.MM.dd')}</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
