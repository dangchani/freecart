import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { Star, Edit, Trash2, PenLine } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Review {
  id: string;
  productId: string;
  productSlug: string;
  productName: string;
  rating: number;
  content: string;
  images: string[];
  createdAt: string;
}

interface WritableReview {
  orderItemId: string;
  productId: string;
  productSlug: string;
  productName: string;
  productImage: string;
  orderedAt: string;
}

const TABS = [
  { value: 'written', label: '작성한 리뷰' },
  { value: 'writable', label: '작성 가능한 리뷰' },
];

export default function ReviewsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'written' | 'writable'>('written');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [writableReviews, setWritableReviews] = useState<WritableReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate('/auth/login'); return; }
      if (activeTab === 'written') loadReviews();
      else loadWritableReviews();
    }
  }, [user, authLoading, navigate, activeTab]);

  async function loadReviews() {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('reviews')
        .select('id, product_id, rating, content, created_at, products(name, slug), review_images(url)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setReviews(
        (data || []).map((r: any) => ({
          id: r.id,
          productId: r.product_id,
          productSlug: r.products?.slug || '',
          productName: r.products?.name || '',
          rating: r.rating,
          content: r.content,
          images: (r.review_images || []).map((img: any) => img.url),
          createdAt: r.created_at,
        }))
      );
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadWritableReviews() {
    try {
      setLoading(true);
      const supabase = createClient();

      // orders 기준으로 쿼리 — user_id를 최상위 컬럼으로 직접 필터링
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id, status, confirmed_at,
          order_items(
            id, product_id, product_image,
            products(name, slug)
          )
        `)
        .eq('user_id', user!.id)
        .in('status', ['delivered', 'confirmed']);

      if (error) throw error;

      if (!orders || orders.length === 0) {
        setWritableReviews([]);
        return;
      }

      // order_items 평탄화
      const allItems: { orderItemId: string; productId: string; productSlug: string; productName: string; productImage: string; orderedAt: string }[] = [];
      for (const order of orders) {
        for (const item of (order.order_items as any[]) || []) {
          allItems.push({
            orderItemId: item.id,
            productId: item.product_id,
            productSlug: item.products?.slug || '',
            productName: item.products?.name || '',
            productImage: item.product_image || '',
            orderedAt: order.confirmed_at || '',
          });
        }
      }

      if (allItems.length === 0) {
        setWritableReviews([]);
        return;
      }

      // 이미 작성한 리뷰의 order_item_id 목록 조회
      const orderItemIds = allItems.map((i) => i.orderItemId);
      const { data: existingReviews } = await supabase
        .from('reviews')
        .select('order_item_id')
        .eq('user_id', user!.id)
        .in('order_item_id', orderItemIds);

      const reviewedItemIds = new Set((existingReviews || []).map((r: any) => r.order_item_id));

      // 리뷰 미작성 아이템만 필터
      setWritableReviews(allItems.filter((item) => !reviewedItemIds.has(item.orderItemId)));
    } catch (err) {
      console.error('Failed to load writable reviews:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(reviewId: string) {
    if (!confirm('리뷰를 삭제하시겠습니까?')) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('reviews').delete().eq('id', reviewId).eq('user_id', user!.id);
      if (error) throw error;
      await loadReviews();
    } catch (err) {
      alert(err instanceof Error ? err.message : '리뷰 삭제 중 오류가 발생했습니다.');
    }
  }

  if (authLoading) return <div className="py-8">로딩 중...</div>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">리뷰 관리</h2>

      {/* 탭 */}
      <div className="flex gap-1 border-b mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value as 'written' | 'writable')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.value
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
      ) : activeTab === 'written' ? (
        /* ── 작성한 리뷰 탭 ── */
        reviews.length === 0 ? (
          <div className="py-16 text-center">
            <Star className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-400 mb-4">작성한 리뷰가 없습니다.</p>
            <Link to="/products"><Button size="sm">쇼핑하러 가기</Button></Link>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card key={review.id} className="p-5">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <Link
                      to={review.productSlug ? `/products/${review.productSlug}` : `/products/${review.productId}`}
                      className="font-semibold hover:underline text-gray-900"
                    >
                      {review.productName}
                    </Link>
                    <div className="mt-1 flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                      ))}
                      <span className="ml-2 text-xs text-gray-400">
                        {format(new Date(review.createdAt), 'yyyy.MM.dd')}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/mypage/reviews/${review.id}/edit`}>
                      <Button size="sm" variant="outline"><Edit className="h-4 w-4" /></Button>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(review.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-600 mb-3">{review.content}</p>
                {review.images.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {review.images.map((img, i) => (
                      <div key={i} className="h-20 w-20 overflow-hidden rounded-lg border bg-gray-100">
                        <img src={img} alt={`리뷰 이미지 ${i + 1}`} className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      ) : (
        /* ── 작성 가능한 리뷰 탭 ── */
        writableReviews.length === 0 ? (
          <div className="py-16 text-center">
            <PenLine className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-400">작성 가능한 리뷰가 없습니다.</p>
            <p className="text-xs text-gray-300 mt-1">구매확정된 상품의 리뷰를 작성할 수 있어요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {writableReviews.map((item) => (
              <Card key={item.orderItemId} className="p-4">
                <div className="flex items-center gap-4">
                  {item.productImage && (
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-gray-100">
                      <img src={item.productImage} alt={item.productName} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{item.productName}</p>
                    {item.orderedAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        구매확정일: {format(new Date(item.orderedAt), 'yyyy.MM.dd')}
                      </p>
                    )}
                  </div>
                  <Link
                    to={`/products/${item.productSlug || item.productId}?tab=reviews&write=1&orderItemId=${item.orderItemId}`}
                    className="shrink-0"
                  >
                    <Button size="sm">리뷰 작성</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
