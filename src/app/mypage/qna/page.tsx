import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, Lock, MessageCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface QnaItem {
  id: string;
  productName: string;
  productSlug: string;
  question: string;
  isSecret: boolean;
  isAnswered: boolean;
  createdAt: string;
  answer?: string;
  answeredAt?: string;
}

const FILTER_TABS = [
  { value: '', label: '전체' },
  { value: 'unanswered', label: '미답변' },
  { value: 'answered', label: '답변완료' },
];

export default function MypageQnaPage() {
  const { user } = useAuth();
  const [qnaList, setQnaList] = useState<QnaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadQna();
  }, [user, filter]);

  async function loadQna() {
    try {
      setLoading(true);
      const supabase = createClient();

      let query = supabase
        .from('product_qna')
        .select('id, question, is_secret, answer, answered_at, created_at, products(name, slug)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (filter === 'unanswered') query = query.is('answer', null);
      if (filter === 'answered') query = query.not('answer', 'is', null);

      const { data, error } = await query;
      if (error) throw error;

      setQnaList(
        (data || []).map((q: any) => ({
          id: q.id,
          productName: q.products?.name || '',
          productSlug: q.products?.slug || '',
          question: q.question,
          isSecret: q.is_secret,
          isAnswered: !!q.answer,
          createdAt: q.created_at,
          answer: q.answer || undefined,
          answeredAt: q.answered_at || undefined,
        }))
      );
    } catch {
      // 오류 시 빈 목록 유지
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">상품 Q&A</h2>

      {/* 필터 탭 */}
      <div className="flex gap-1 border-b mb-6">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              filter === tab.value
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">불러오는 중...</div>
      ) : qnaList.length === 0 ? (
        <div className="py-16 text-center">
          <MessageCircle className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-gray-400 text-sm">작성한 Q&A가 없습니다.</p>
        </div>
      ) : (
        <div className="divide-y border rounded-lg overflow-hidden">
          {qnaList.map((qna) => {
            const isOpen = expandedId === qna.id;
            return (
              <div key={qna.id} className="bg-white">
                {/* 질문 행 */}
                <button
                  className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isOpen ? null : qna.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Q</span>
                      {qna.isSecret && <Lock className="shrink-0 h-3.5 w-3.5 text-gray-400" />}
                      <span className="text-sm text-gray-800 truncate">{qna.question}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={qna.isAnswered ? 'default' : 'secondary'} className="text-xs">
                        {qna.isAnswered ? '답변완료' : '미답변'}
                      </Badge>
                      {isOpen
                        ? <ChevronUp className="h-4 w-4 text-gray-400" />
                        : <ChevronDown className="h-4 w-4 text-gray-400" />
                      }
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-400 pl-7">
                    {qna.productSlug ? (
                      <Link
                        to={`/products/${qna.productSlug}`}
                        className="font-medium text-blue-500 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {qna.productName}
                      </Link>
                    ) : (
                      <span>{qna.productName}</span>
                    )}
                    <span>·</span>
                    <span>{qna.createdAt ? format(new Date(qna.createdAt), 'yyyy.MM.dd') : ''}</span>
                  </div>
                </button>

                {/* 펼침: 질문 전문 + 답변 */}
                {isOpen && (
                  <div className="border-t bg-gray-50 px-5 py-4 space-y-4">
                    <div className="flex gap-3">
                      <span className="shrink-0 text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded h-fit">Q</span>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{qna.question}</p>
                    </div>

                    {qna.answer ? (
                      <div className="flex gap-3 border-l-4 border-blue-400 bg-blue-50 px-4 py-3 rounded-r-md">
                        <span className="shrink-0 text-xs font-bold text-white bg-blue-500 px-1.5 py-0.5 rounded h-fit">A</span>
                        <div>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{qna.answer}</p>
                          {qna.answeredAt && (
                            <p className="mt-1.5 text-xs text-gray-400">
                              {format(new Date(qna.answeredAt), 'yyyy.MM.dd')} 답변
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic pl-1">아직 답변이 등록되지 않았습니다.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
