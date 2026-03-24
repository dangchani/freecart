import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Inquiry {
  id: string;
  title: string;
  category: string;
  authorName: string;
  status: 'pending' | 'answered';
  createdAt: string;
  content: string;
  answer?: string;
}

const statusTabs = [
  { value: '', label: '전체' },
  { value: 'pending', label: '미답변' },
  { value: 'answered', label: '답변완료' },
];

const categoryLabels: Record<string, string> = {
  order: '주문',
  shipping: '배송',
  product: '상품',
  payment: '결제',
  refund: '환불',
  etc: '기타',
};

export default function AdminInquiriesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answerContent, setAnswerContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadInquiries();
    }
  }, [user, authLoading, statusFilter, navigate]);

  async function loadInquiries() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const response = await fetch(`/api/admin/inquiries?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setInquiries(data.data || []);
      } else {
        setError(data.error || '문의 목록을 불러오지 못했습니다.');
      }
    } catch {
      setError('문의 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswer(inquiryId: string) {
    if (!answerContent.trim()) {
      alert('답변 내용을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/inquiries/${inquiryId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: answerContent }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      alert('답변이 등록되었습니다.');
      setExpandedId(null);
      setAnswerContent('');
      await loadInquiries();
    } catch (err) {
      alert(err instanceof Error ? err.message : '답변 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-3xl font-bold">1:1 문의 관리</h1>

      <div className="mb-6 flex gap-2 border-b">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-500">로딩 중...</div>
      ) : inquiries.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">문의 내역이 없습니다.</p>
        </Card>
      ) : (
        <Card>
          <div className="divide-y">
            {inquiries.map((inquiry) => (
              <div key={inquiry.id}>
                <div
                  className="flex cursor-pointer items-center gap-4 p-4 hover:bg-gray-50"
                  onClick={() => {
                    setExpandedId(expandedId === inquiry.id ? null : inquiry.id);
                    setAnswerContent('');
                  }}
                >
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="font-medium">{inquiry.title}</h3>
                      <Badge variant="outline">
                        {categoryLabels[inquiry.category] || inquiry.category}
                      </Badge>
                      <Badge variant={inquiry.status === 'answered' ? 'default' : 'secondary'}>
                        {inquiry.status === 'answered' ? '답변완료' : '미답변'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>{inquiry.authorName}</span>
                      <span>
                        {inquiry.createdAt
                          ? format(new Date(inquiry.createdAt), 'yyyy.MM.dd HH:mm')
                          : '-'}
                      </span>
                    </div>
                  </div>
                  {expandedId === inquiry.id ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </div>

                {expandedId === inquiry.id && (
                  <div className="border-t bg-gray-50 px-4 py-4">
                    <div className="mb-4">
                      <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">문의 내용</p>
                      <p className="whitespace-pre-wrap text-sm text-gray-800">{inquiry.content}</p>
                    </div>

                    {inquiry.answer && (
                      <div className="mb-4 rounded-md border-l-4 border-blue-400 bg-blue-50 px-4 py-3">
                        <p className="mb-1 text-xs font-semibold text-blue-600">관리자 답변</p>
                        <p className="whitespace-pre-wrap text-sm text-gray-800">{inquiry.answer}</p>
                      </div>
                    )}

                    {inquiry.status !== 'answered' && (
                      <div>
                        <p className="mb-2 text-xs font-semibold text-gray-500">답변 작성</p>
                        <textarea
                          value={answerContent}
                          onChange={(e) => setAnswerContent(e.target.value)}
                          rows={4}
                          placeholder="답변 내용을 입력하세요"
                          className="mb-2 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAnswer(inquiry.id)}
                          disabled={submitting}
                        >
                          {submitting ? '등록 중...' : '답변 등록'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
