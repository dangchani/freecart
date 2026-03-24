import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye, Pin } from 'lucide-react';
import { format } from 'date-fns';

interface Notice {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt?: string;
}

export default function NoticeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNotice();
  }, [id]);

  async function fetchNotice() {
    try {
      const res = await fetch(`/api/notices/${id}`);
      const json = await res.json();
      if (json.success) {
        setNotice(json.data);
      } else {
        setError(json.error || '공지사항을 찾을 수 없습니다.');
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

  if (error || !notice) {
    return (
      <div className="container py-8">
        <Link to="/notices" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="mr-1 h-4 w-4" />
          공지사항 목록
        </Link>
        <Card className="p-12 text-center">
          <p className="mb-4 text-gray-500">{error || '공지사항을 찾을 수 없습니다.'}</p>
          <Button variant="outline" onClick={() => navigate('/notices')}>
            목록으로 돌아가기
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <Link to="/notices" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        공지사항 목록
      </Link>

      <Card className="overflow-hidden">
        {/* 헤더 */}
        <div className={`border-b p-6 ${notice.isPinned ? 'bg-blue-50' : 'bg-gray-50'}`}>
          <div className="mb-2 flex items-start gap-2">
            {notice.isPinned && (
              <Pin className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" fill="currentColor" />
            )}
            <h1 className="text-xl font-bold">{notice.title}</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{format(new Date(notice.createdAt), 'yyyy년 MM월 dd일 HH:mm')}</span>
            {notice.updatedAt && notice.updatedAt !== notice.createdAt && (
              <span className="text-xs">(수정: {format(new Date(notice.updatedAt), 'yyyy.MM.dd')})</span>
            )}
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {notice.viewCount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-6">
          <div className="min-h-[200px] whitespace-pre-wrap text-gray-700 leading-relaxed">
            {notice.content}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="border-t p-4">
          <Link to="/notices">
            <Button variant="outline">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              목록으로
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
