import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

interface Inquiry {
  id: string;
  title: string;
  category: string;
  status: 'pending' | 'answered' | 'closed';
  content: string;
  answer?: string;
  answeredAt?: string;
  createdAt: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  pending: { label: '답변대기', variant: 'secondary' },
  answered: { label: '답변완료', variant: 'default' },
  closed: { label: '종료', variant: 'outline' },
};

const categoryLabels: Record<string, string> = {
  order: '주문',
  shipping: '배송',
  product: '상품',
  payment: '결제',
  refund: '환불',
  other: '기타',
};

export default function InquiriesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      fetchInquiries();
    }
  }, [user, authLoading, navigate]);

  async function fetchInquiries() {
    try {
      const res = await fetch('/api/users/me/inquiries');
      const json = await res.json();
      if (json.success) setInquiries(json.data || []);
    } catch (err) {
      console.error('문의 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  if (authLoading || loading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">1:1 문의</h1>
        <Link to="/mypage/inquiries/new">
          <Button size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            문의하기
          </Button>
        </Link>
      </div>

      {inquiries.length === 0 ? (
        <Card className="p-12 text-center">
          <MessageCircle className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <p className="mb-4 text-gray-500">문의 내역이 없습니다.</p>
          <Link to="/mypage/inquiries/new">
            <Button>문의하기</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inquiry) => {
            const statusInfo = statusConfig[inquiry.status] || statusConfig.pending;
            const isExpanded = expandedId === inquiry.id;

            return (
              <Card key={inquiry.id} className="overflow-hidden">
                <button
                  className="w-full p-4 text-left hover:bg-gray-50"
                  onClick={() => toggleExpand(inquiry.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {categoryLabels[inquiry.category] || inquiry.category}
                        </Badge>
                        <Badge variant={statusInfo.variant} className="text-xs">
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <p className="font-medium">{inquiry.title}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {format(new Date(inquiry.createdAt), 'yyyy.MM.dd HH:mm')}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t px-4 py-4">
                    <div className="mb-4 rounded-md bg-gray-50 p-3">
                      <p className="mb-1 text-xs font-medium text-gray-500">문의 내용</p>
                      <p className="whitespace-pre-wrap text-sm">{inquiry.content}</p>
                    </div>
                    {inquiry.answer ? (
                      <div className="rounded-md bg-blue-50 p-3">
                        <p className="mb-1 text-xs font-medium text-blue-600">
                          관리자 답변
                          {inquiry.answeredAt && (
                            <span className="ml-2 text-gray-400">
                              {format(new Date(inquiry.answeredAt), 'yyyy.MM.dd HH:mm')}
                            </span>
                          )}
                        </p>
                        <p className="whitespace-pre-wrap text-sm">{inquiry.answer}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">아직 답변이 등록되지 않았습니다.</p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
