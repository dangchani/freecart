import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { Lock, ChevronDown, ChevronUp } from 'lucide-react';

interface ProductQna {
  id: string;
  productName: string;
  authorName: string;
  content: string;
  isSecret: boolean;
  isAnswered: boolean;
  createdAt: string;
  answer?: string;
}

const filterOptions = [
  { value: '', label: '전체' },
  { value: 'unanswered', label: '미답변' },
  { value: 'answered', label: '답변완료' },
];

export default function AdminProductQnaPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [qnaList, setQnaList] = useState<ProductQna[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answerContent, setAnswerContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadQna();
    }
  }, [user, authLoading, filter, navigate]);

  async function loadQna() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter) params.set('filter', filter);
      const response = await fetch(`/api/admin/product-qna?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setQnaList(data.data || []);
      } else {
        setError(data.error || 'Q&A 목록을 불러오지 못했습니다.');
      }
    } catch {
      setError('Q&A 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswer(qnaId: string) {
    if (!answerContent.trim()) {
      alert('답변 내용을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/product-qna/${qnaId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: answerContent }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      alert('답변이 등록되었습니다.');
      setExpandedId(null);
      setAnswerContent('');
      await loadQna();
    } catch (err) {
      alert(err instanceof Error ? err.message : '답변 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-3xl font-bold">상품 Q&A 관리</h1>

      <div className="mb-6 flex gap-2 border-b">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              filter === opt.value
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-500">로딩 중...</div>
      ) : qnaList.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">Q&A 내역이 없습니다.</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">상품명</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">질문자</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">질문내용</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">비밀글</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">답변여부</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">날짜</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">답변</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {qnaList.map((qna) => (
                  <>
                    <tr key={qna.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{qna.productName}</td>
                      <td className="px-4 py-3 text-gray-600">{qna.authorName}</td>
                      <td className="max-w-xs px-4 py-3">
                        <span className="line-clamp-1 text-gray-700">{qna.content}</span>
                      </td>
                      <td className="px-4 py-3">
                        {qna.isSecret && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <Lock className="h-3.5 w-3.5" />
                            <span className="text-xs">비밀글</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={qna.isAnswered ? 'default' : 'secondary'}>
                          {qna.isAnswered ? '답변완료' : '미답변'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {qna.createdAt
                          ? format(new Date(qna.createdAt), 'yyyy.MM.dd')
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setExpandedId(expandedId === qna.id ? null : qna.id);
                            setAnswerContent('');
                          }}
                        >
                          {expandedId === qna.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                    {expandedId === qna.id && (
                      <tr key={`${qna.id}-detail`}>
                        <td colSpan={7} className="bg-gray-50 px-4 py-4">
                          <div className="mb-3">
                            <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">질문</p>
                            <p className="whitespace-pre-wrap text-sm text-gray-800">{qna.content}</p>
                          </div>
                          {qna.answer && (
                            <div className="mb-3 rounded-md border-l-4 border-blue-400 bg-blue-50 px-4 py-3">
                              <p className="mb-1 text-xs font-semibold text-blue-600">기존 답변</p>
                              <p className="whitespace-pre-wrap text-sm text-gray-800">{qna.answer}</p>
                            </div>
                          )}
                          <div>
                            <p className="mb-2 text-xs font-semibold text-gray-500">
                              {qna.isAnswered ? '답변 수정' : '답변 작성'}
                            </p>
                            <textarea
                              value={answerContent}
                              onChange={(e) => setAnswerContent(e.target.value)}
                              rows={3}
                              placeholder="답변 내용을 입력하세요"
                              className="mb-2 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleAnswer(qna.id)}
                                disabled={submitting}
                              >
                                {submitting ? '등록 중...' : '답변 등록'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setExpandedId(null)}
                              >
                                닫기
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
