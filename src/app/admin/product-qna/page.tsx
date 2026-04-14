import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { Lock, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

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

interface Category {
  id: string;
  name: string;
}

const ANSWER_TABS = [
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answerContent, setAnswerContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 필터 상태
  const [rootCategories, setRootCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [selectedRoot, setSelectedRoot] = useState('');
  const [selectedSub, setSelectedSub] = useState('');
  const [productSearchInput, setProductSearchInput] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [answerFilter, setAnswerFilter] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate('/auth/login'); return; }
      loadCategories();
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && user) loadQna();
  }, [user, authLoading, selectedRoot, selectedSub, productSearch, answerFilter]);

  useEffect(() => {
    setSelectedSub('');
    if (!selectedRoot) { setSubCategories([]); return; }
    const supabase = createClient();
    supabase
      .from('product_categories')
      .select('id, name')
      .eq('parent_id', selectedRoot)
      .eq('is_visible', true)
      .order('sort_order')
      .then(({ data }) => setSubCategories((data || []).map((c: any) => ({ id: c.id, name: c.name }))));
  }, [selectedRoot]);

  async function loadCategories() {
    const supabase = createClient();
    const { data } = await supabase
      .from('product_categories')
      .select('id, name')
      .is('parent_id', null)
      .eq('is_visible', true)
      .order('sort_order');
    setRootCategories((data || []).map((c: any) => ({ id: c.id, name: c.name })));
  }

  async function loadQna() {
    try {
      setLoading(true);
      const supabase = createClient();

      // 카테고리 필터 → 상품 id 목록
      let productIds: string[] | null = null;
      const categoryId = selectedSub || selectedRoot;
      if (categoryId) {
        const { data: prods } = await supabase.from('products').select('id').eq('category_id', categoryId);
        productIds = (prods || []).map((p: any) => p.id);
        if (productIds.length === 0) { setQnaList([]); setLoading(false); return; }
      }

      let query = supabase
        .from('product_qna')
        .select('id, question, is_secret, answer, created_at, products(name), users(name)')
        .order('created_at', { ascending: false });

      if (productIds) query = query.in('product_id', productIds);
      if (answerFilter === 'unanswered') query = query.is('answer', null);
      if (answerFilter === 'answered') query = query.not('answer', 'is', null);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      let result = (data || []).map((q: any) => ({
        id: q.id,
        productName: q.products?.name || '',
        authorName: q.users?.name || '',
        content: q.question,
        isSecret: q.is_secret,
        isAnswered: !!q.answer,
        createdAt: q.created_at,
        answer: q.answer || undefined,
      }));

      if (productSearch.trim()) {
        result = result.filter((q) => q.productName.includes(productSearch.trim()));
      }

      setQnaList(result);
    } catch {
      setError('Q&A 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswer(qnaId: string) {
    if (!answerContent.trim()) { alert('답변 내용을 입력해주세요.'); return; }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('product_qna')
        .update({ answer: answerContent, answered_at: new Date().toISOString() })
        .eq('id', qnaId);
      if (error) throw error;
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

      {/* 필터 영역 */}
      <div className="mb-4 flex flex-wrap gap-3 items-end">
        {/* 루트 카테고리 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">카테고리</label>
          <select
            value={selectedRoot}
            onChange={(e) => setSelectedRoot(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
          >
            <option value="">전체 카테고리</option>
            {rootCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* 하위 카테고리 */}
        {subCategories.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">하위 카테고리</label>
            <select
              value={selectedSub}
              onChange={(e) => setSelectedSub(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
            >
              <option value="">전체</option>
              {subCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* 상품명 검색 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">상품명 검색</label>
          <div className="flex gap-1">
            <input
              type="text"
              value={productSearchInput}
              onChange={(e) => setProductSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setProductSearch(productSearchInput)}
              placeholder="상품명 입력"
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
            />
            <button
              onClick={() => setProductSearch(productSearchInput)}
              className="border rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
            >
              <Search className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </div>

        {(selectedRoot || productSearch) && (
          <button
            onClick={() => {
              setSelectedRoot(''); setSelectedSub('');
              setProductSearch(''); setProductSearchInput('');
            }}
            className="text-xs text-gray-400 hover:text-gray-600 underline self-end pb-2"
          >
            필터 초기화
          </button>
        )}
      </div>

      {/* 답변 탭 */}
      <div className="mb-6 flex gap-1 border-b">
        {ANSWER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setAnswerFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              answerFilter === tab.value
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

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
                        {qna.createdAt ? format(new Date(qna.createdAt), 'yyyy.MM.dd') : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setExpandedId(expandedId === qna.id ? null : qna.id); setAnswerContent(''); }}
                        >
                          {expandedId === qna.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                            <p className="mb-2 text-xs font-semibold text-gray-500">{qna.isAnswered ? '답변 수정' : '답변 작성'}</p>
                            <textarea
                              value={answerContent}
                              onChange={(e) => setAnswerContent(e.target.value)}
                              rows={3}
                              placeholder="답변 내용을 입력하세요"
                              className="mb-2 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleAnswer(qna.id)} disabled={submitting}>
                                {submitting ? '등록 중...' : '답변 등록'}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setExpandedId(null)}>닫기</Button>
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
