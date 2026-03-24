import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { Star } from 'lucide-react';

interface Review {
  id: string;
  productName: string;
  authorName: string;
  rating: number;
  content: string;
  createdAt: string;
  isVisible: boolean;
  isBest: boolean;
}

export default function AdminReviewsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadReviews();
    }
  }, [user, authLoading, navigate]);

  async function loadReviews() {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/reviews');
      const data = await response.json();
      if (data.success) {
        setReviews(data.data || []);
      } else {
        setError(data.error || '리뷰 목록을 불러오지 못했습니다.');
      }
    } catch {
      setError('리뷰 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleVisible(reviewId: string, current: boolean) {
    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVisible: !current }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      await loadReviews();
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    }
  }

  async function handleToggleBest(reviewId: string, current: boolean) {
    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBest: !current }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      await loadReviews();
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    }
  }

  async function handleReplySubmit(reviewId: string) {
    if (!replyContent.trim()) {
      alert('답변 내용을 입력해주세요.');
      return;
    }
    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      alert('답변이 등록되었습니다.');
      setReplyingId(null);
      setReplyContent('');
      await loadReviews();
    } catch (err) {
      alert(err instanceof Error ? err.message : '답변 등록 중 오류가 발생했습니다.');
    }
  }

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-3xl font-bold">리뷰 관리</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-500">로딩 중...</div>
      ) : reviews.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">등록된 리뷰가 없습니다.</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">상품명</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">작성자</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">별점</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">내용</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">날짜</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">상태</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reviews.map((review) => (
                  <>
                    <tr key={review.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{review.productName}</td>
                      <td className="px-4 py-3 text-gray-600">{review.authorName}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          <span>{review.rating}</span>
                        </div>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-gray-600">
                        <span className="line-clamp-2">{review.content}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {review.createdAt
                          ? format(new Date(review.createdAt), 'yyyy.MM.dd')
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Badge variant={review.isVisible ? 'default' : 'secondary'}>
                            {review.isVisible ? '노출' : '숨김'}
                          </Badge>
                          {review.isBest && <Badge variant="outline">베스트</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleVisible(review.id, review.isVisible)}
                          >
                            {review.isVisible ? '숨기기' : '노출'}
                          </Button>
                          <Button
                            size="sm"
                            variant={review.isBest ? 'default' : 'outline'}
                            onClick={() => handleToggleBest(review.id, review.isBest)}
                          >
                            베스트
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReplyingId(replyingId === review.id ? null : review.id);
                              setReplyContent('');
                            }}
                          >
                            답변
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {replyingId === review.id && (
                      <tr key={`${review.id}-reply`}>
                        <td colSpan={7} className="bg-blue-50 px-4 py-3">
                          <div className="flex gap-2">
                            <textarea
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              rows={2}
                              placeholder="답변 내용을 입력하세요"
                              className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex flex-col gap-1">
                              <Button
                                size="sm"
                                onClick={() => handleReplySubmit(review.id)}
                              >
                                등록
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setReplyingId(null)}
                              >
                                취소
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
