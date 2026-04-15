import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { Star, Search, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Review {
  id: string;
  productName: string;
  authorName: string;
  rating: number;
  content: string;
  createdAt: string;
  isVisible: boolean;
  isBest: boolean;
  adminReply: string | null;
  adminRepliedAt: string | null;
}

interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

const VISIBILITY_TABS = [
  { value: '', label: '전체' },
  { value: 'visible', label: '노출' },
  { value: 'hidden', label: '숨김' },
];

const RATING_OPTIONS = [
  { value: '', label: '전체 별점' },
  { value: '5', label: '★ 5점' },
  { value: '4', label: '★ 4점' },
  { value: '3', label: '★ 3점' },
  { value: '2', label: '★ 2점' },
  { value: '1', label: '★ 1점' },
];

export default function AdminReviewsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [expandedReplyId, setExpandedReplyId] = useState<string | null>(null);

  // 필터 상태
  const [rootCategories, setRootCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [selectedRoot, setSelectedRoot] = useState('');
  const [selectedSub, setSelectedSub] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productSearchInput, setProductSearchInput] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate('/auth/login'); return; }
      loadCategories();
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && user) loadReviews();
  }, [user, authLoading, selectedRoot, selectedSub, productSearch, visibilityFilter, ratingFilter]);

  // 루트 카테고리 선택 시 하위 카테고리 로드
  useEffect(() => {
    setSelectedSub('');
    if (!selectedRoot) { setSubCategories([]); return; }
    const supabase = createClient();
    supabase
      .from('product_categories')
      .select('id, name, parent_id')
      .eq('parent_id', selectedRoot)
      .eq('is_visible', true)
      .order('sort_order')
      .then(({ data }) => setSubCategories((data || []).map((c: any) => ({ id: c.id, name: c.name, parentId: c.parent_id }))));
  }, [selectedRoot]);

  async function loadCategories() {
    const supabase = createClient();
    const { data } = await supabase
      .from('product_categories')
      .select('id, name, parent_id')
      .is('parent_id', null)
      .eq('is_visible', true)
      .order('sort_order');
    setRootCategories((data || []).map((c: any) => ({ id: c.id, name: c.name, parentId: null })));
  }

  async function loadReviews() {
    try {
      setLoading(true);
      const supabase = createClient();

      // 카테고리 필터가 있으면 해당 상품 id 목록 먼저 조회
      let productIds: string[] | null = null;
      const categoryId = selectedSub || selectedRoot;
      if (categoryId) {
        const { data: prods } = await supabase
          .from('products')
          .select('id')
          .eq('category_id', categoryId);
        productIds = (prods || []).map((p: any) => p.id);
        if (productIds.length === 0) {
          setReviews([]);
          setLoading(false);
          return;
        }
      }

      let query = supabase
        .from('reviews')
        .select('id, rating, content, is_visible, is_best, created_at, admin_reply, admin_replied_at, products(id, name), users(name)')
        .order('created_at', { ascending: false });

      if (productIds) query = query.in('product_id', productIds);
      if (visibilityFilter === 'visible') query = query.eq('is_visible', true);
      if (visibilityFilter === 'hidden') query = query.eq('is_visible', false);
      if (ratingFilter) query = query.eq('rating', parseInt(ratingFilter));

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      let result = (data || []).map((r: any) => ({
        id: r.id,
        productName: r.products?.name || '',
        authorName: r.users?.name || '',
        rating: r.rating,
        content: r.content,
        createdAt: r.created_at,
        isVisible: r.is_visible,
        isBest: r.is_best,
        adminReply: r.admin_reply || null,
        adminRepliedAt: r.admin_replied_at || null,
      }));

      // 상품명 텍스트 검색 (클라이언트 필터)
      if (productSearch.trim()) {
        result = result.filter((r) => r.productName.includes(productSearch.trim()));
      }

      setReviews(result);
    } catch {
      setError('리뷰 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleVisible(reviewId: string, current: boolean) {
    const supabase = createClient();
    await supabase.from('reviews').update({ is_visible: !current }).eq('id', reviewId);
    await loadReviews();
  }

  async function handleToggleBest(reviewId: string, current: boolean) {
    const supabase = createClient();
    await supabase.from('reviews').update({ is_best: !current }).eq('id', reviewId);
    await loadReviews();
  }

  async function handleReplySubmit(reviewId: string) {
    if (!replyContent.trim()) { alert('답변 내용을 입력해주세요.'); return; }
    try {
      setReplySubmitting(true);
      const supabase = createClient();
      const { error } = await supabase.from('reviews').update({
        admin_reply: replyContent,
        admin_replied_at: new Date().toISOString(),
      }).eq('id', reviewId);
      if (error) throw error;
      setReplyingId(null);
      setReplyContent('');
      await loadReviews();
    } catch (err) {
      alert(err instanceof Error ? err.message : '답변 등록 중 오류가 발생했습니다.');
    } finally {
      setReplySubmitting(false);
    }
  }

  async function handleReplyDelete(reviewId: string) {
    if (!confirm('답변을 삭제하시겠습니까?')) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('reviews').update({
        admin_reply: null,
        admin_replied_at: null,
      }).eq('id', reviewId);
      if (error) throw error;
      setExpandedReplyId(null);
      setReplyingId(null);
      setReplyContent('');
      await loadReviews();
    } catch (err) {
      alert(err instanceof Error ? err.message : '답변 삭제 중 오류가 발생했습니다.');
    }
  }

  function openReplyForm(review: Review) {
    if (replyingId === review.id) {
      setReplyingId(null);
      setReplyContent('');
    } else {
      setReplyingId(review.id);
      setReplyContent(review.adminReply || '');
    }
  }

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-3xl font-bold">리뷰 관리</h1>

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

        {/* 별점 필터 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">별점</label>
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {RATING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* 필터 초기화 */}
        {(selectedRoot || productSearch || ratingFilter || visibilityFilter) && (
          <button
            onClick={() => {
              setSelectedRoot(''); setSelectedSub('');
              setProductSearch(''); setProductSearchInput('');
              setRatingFilter(''); setVisibilityFilter('');
            }}
            className="text-xs text-gray-400 hover:text-gray-600 underline self-end pb-2"
          >
            필터 초기화
          </button>
        )}
      </div>

      {/* 노출 탭 */}
      <div className="mb-4 flex gap-1 border-b">
        {VISIBILITY_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setVisibilityFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              visibilityFilter === tab.value
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
                  <th className="px-4 py-3 text-center font-medium text-gray-600">상품명</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">작성자</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">별점</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">내용</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">날짜</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">상태</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reviews.map((review) => (
                  <>
                    <tr key={review.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-center font-medium">{review.productName}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{review.authorName}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          <span>{review.rating}</span>
                        </div>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-center text-gray-600">
                        <span className="line-clamp-2">{review.content}</span>
                        {/* 기존 답변 미리보기 */}
                        {review.adminReply && (
                          <button
                            type="button"
                            onClick={() => setExpandedReplyId(expandedReplyId === review.id ? null : review.id)}
                            className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            <MessageSquare className="h-3 w-3" />
                            답변 있음
                            {expandedReplyId === review.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {review.createdAt ? format(new Date(review.createdAt), 'yyyy.MM.dd') : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
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
                            {review.isBest ? '베스트 해제' : '베스트'}
                          </Button>
                          <Button
                            size="sm"
                            variant={replyingId === review.id ? 'default' : 'outline'}
                            onClick={() => openReplyForm(review)}
                          >
                            {review.adminReply ? '답변 수정' : '답변'}
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* 기존 답변 펼침 */}
                    {expandedReplyId === review.id && review.adminReply && replyingId !== review.id && (
                      <tr key={`${review.id}-reply-view`}>
                        <td colSpan={7} className="bg-blue-50 px-6 py-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <p className="mb-1 text-xs font-medium text-blue-700">판매자 답변</p>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.adminReply}</p>
                              {review.adminRepliedAt && (
                                <p className="mt-1 text-xs text-gray-400">
                                  {format(new Date(review.adminRepliedAt), 'yyyy.MM.dd HH:mm')}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-700 shrink-0"
                              onClick={() => handleReplyDelete(review.id)}
                            >
                              삭제
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* 답변 입력 폼 */}
                    {replyingId === review.id && (
                      <tr key={`${review.id}-reply-form`}>
                        <td colSpan={7} className="bg-blue-50 px-4 py-3">
                          <div className="flex gap-2">
                            <textarea
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              rows={3}
                              placeholder="답변 내용을 입력하세요"
                              className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex flex-col gap-1">
                              <Button
                                size="sm"
                                disabled={replySubmitting}
                                onClick={() => handleReplySubmit(review.id)}
                              >
                                {replySubmitting ? '저장 중...' : '저장'}
                              </Button>
                              {review.adminReply && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => handleReplyDelete(review.id)}
                                >
                                  삭제
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setReplyingId(null); setReplyContent(''); }}
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
