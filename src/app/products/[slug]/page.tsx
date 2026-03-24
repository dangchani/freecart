import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getProductBySlug } from '@/services/products';
import { addToCart } from '@/services/cart';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Minus, Plus, ShoppingCart, Zap, ArrowLeft, Check, Star, ChevronDown, ChevronUp } from 'lucide-react';

interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  content: string;
  createdAt: string;
}

interface QnA {
  id: string;
  userId: string;
  userName: string;
  question: string;
  answer?: string;
  answeredAt?: string;
  createdAt: string;
  isSecret?: boolean;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  description?: string;
  thumbnail?: string;
  images: string[];
  stock: number;
}

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [cartLoading, setCartLoading] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'detail' | 'reviews' | 'qna' | 'shipping'>('detail');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [qnaList, setQnaList] = useState<QnA[]>([]);
  const [qnaLoading, setQnaLoading] = useState(false);
  const [qnaQuestion, setQnaQuestion] = useState('');
  const [qnaSecret, setQnaSecret] = useState(false);
  const [qnaSubmitting, setQnaSubmitting] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false, message: '', type: 'success',
  });

  useEffect(() => {
    if (!slug) return;
    getProductBySlug(slug)
      .then((data) => {
        if (!data) setNotFound(true);
        else setProduct(data as unknown as Product);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    const supabase = createClient();
    async function loadReviews() {
      setReviewsLoading(true);
      try {
        const { data } = await supabase.from('reviews').select('*, profiles(name)').eq('product_slug', slug);
        setReviews(data?.map((r: any) => ({ ...r, userName: r.profiles?.name || '익명' })) || []);
      } catch { setReviews([]); } finally { setReviewsLoading(false); }
    }
    async function loadQna() {
      setQnaLoading(true);
      try {
        const { data } = await supabase.from('product_qna').select('*, profiles(name)').eq('product_slug', slug);
        setQnaList(data?.map((q: any) => ({ ...q, userName: q.profiles?.name || '익명' })) || []);
      } catch { setQnaList([]); } finally { setQnaLoading(false); }
    }
    if (activeTab === 'reviews' && reviews.length === 0) loadReviews();
    if (activeTab === 'qna' && qnaList.length === 0) loadQna();
  }, [activeTab, slug]);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
  }

  async function handleAddToCart() {
    if (!product) return;
    if (!user) { navigate('/auth/login'); return; }
    setCartLoading(true);
    try {
      await addToCart(user.id, product.id, quantity);
      showToast('장바구니에 담겼습니다!', 'success');
    } catch {
      showToast('장바구니 담기 중 오류가 발생했습니다.', 'error');
    } finally {
      setCartLoading(false);
    }
  }

  async function handleBuyNow() {
    if (!product) return;
    if (!user) { navigate('/auth/login'); return; }
    setBuyLoading(true);
    try {
      await addToCart(user.id, product.id, quantity);
      navigate('/checkout');
    } catch {
      showToast('오류가 발생했습니다.', 'error');
      setBuyLoading(false);
    }
  }

  async function submitQuestion() {
    if (!qnaQuestion.trim() || !user || !slug) return;
    setQnaSubmitting(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.from('product_qna').insert({
        product_slug: slug,
        user_id: user.id,
        question: qnaQuestion,
        is_secret: qnaSecret,
      });
      if (!error) {
        setQnaQuestion('');
        setQnaSecret(false);
        setQnaList([]);
        showToast('문의가 등록되었습니다.', 'success');
      } else {
        showToast('문의 등록에 실패했습니다.', 'error');
      }
    } catch {
      showToast('오류가 발생했습니다.', 'error');
    } finally {
      setQnaSubmitting(false);
    }
  }

  function changeQuantity(delta: number) {
    setQuantity((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (product && next > product.stock) return product.stock;
      return next;
    });
  }

  if (loading) {
    return (
      <div className="container py-8">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-lg bg-gray-200" />
          <div className="space-y-4">
            <div className="h-8 animate-pulse rounded bg-gray-200" />
            <div className="h-6 w-1/2 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="container py-8 text-center">
        <p className="mb-4 text-gray-500">상품을 찾을 수 없습니다.</p>
        <Link to="/products"><Button variant="outline"><ArrowLeft className="mr-1.5 h-4 w-4" />상품 목록으로</Button></Link>
      </div>
    );
  }

  const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  const hasDiscount = product.comparePrice && product.comparePrice > product.price;
  const discountPercent = hasDiscount ? Math.round(((product.comparePrice! - product.price) / product.comparePrice!) * 100) : 0;
  const imageUrl = product.thumbnail || product.images?.[0] || '/placeholder.png';
  const isSoldOut = product.stock === 0;

  return (
    <div className="container py-8">
      {toast.show && (
        <div className={`fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' && <Check className="h-4 w-4" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <Link to="/products" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />전체 상품으로
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
          <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
          {isSoldOut && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="rounded-lg bg-black/70 px-6 py-2 text-lg font-bold text-white">품절</span>
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <h1 className="mb-4 text-3xl font-bold">{product.name}</h1>
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold">{formatCurrency(product.price)}</span>
              {hasDiscount && (
                <>
                  <span className="text-xl text-gray-500 line-through">{formatCurrency(product.comparePrice!)}</span>
                  <span className="rounded-md bg-red-500 px-2 py-1 text-sm font-bold text-white">{discountPercent}% OFF</span>
                </>
              )}
            </div>
          </div>

          <div className="mb-6 border-t border-b py-4">
            <div className="mb-2 flex justify-between">
              <span className="text-gray-600">배송비</span>
              <span>3,000원 (50,000원 이상 무료)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">재고</span>
              <span className={isSoldOut ? 'text-red-500 font-medium' : ''}>{isSoldOut ? '품절' : `${product.stock}개`}</span>
            </div>
          </div>

          {product.description && (
            <div className="mb-6">
              <h2 className="mb-3 text-lg font-semibold">상품 설명</h2>
              <p className="whitespace-pre-wrap text-gray-600 leading-relaxed">{product.description}</p>
            </div>
          )}

          {!isSoldOut && (
            <div className="mb-6">
              <p className="mb-2 text-sm font-medium text-gray-700">수량</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-md border">
                  <button className="flex h-10 w-10 items-center justify-center hover:bg-gray-50 disabled:opacity-50" onClick={() => changeQuantity(-1)} disabled={quantity <= 1}>
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center text-sm font-medium">{quantity}</span>
                  <button className="flex h-10 w-10 items-center justify-center hover:bg-gray-50 disabled:opacity-50" onClick={() => changeQuantity(1)} disabled={quantity >= product.stock}>
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <span className="text-sm text-gray-500">최대 {product.stock}개</span>
              </div>
              <p className="mt-2 text-sm font-medium text-gray-700">합계: <span className="text-lg font-bold text-blue-600">{formatCurrency(product.price * quantity)}</span></p>
            </div>
          )}

          <div className="mt-auto flex gap-3">
            <Button size="lg" className="flex-1" onClick={handleAddToCart} disabled={isSoldOut || cartLoading || buyLoading}>
              {cartLoading ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />담는 중...</span>
                : <span className="flex items-center gap-2"><ShoppingCart className="h-4 w-4" />{isSoldOut ? '품절' : '장바구니 담기'}</span>}
            </Button>
            <Button size="lg" variant="outline" className="flex-1" onClick={handleBuyNow} disabled={isSoldOut || cartLoading || buyLoading}>
              {buyLoading ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />처리 중...</span>
                : <span className="flex items-center gap-2"><Zap className="h-4 w-4" />바로 구매</span>}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <div className="flex border-b">
          {([{ key: 'detail', label: '상품 상세' }, { key: 'reviews', label: `리뷰 (${reviews.length})` }, { key: 'qna', label: 'Q&A' }, { key: 'shipping', label: '배송/환불 안내' }] as const).map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="py-8">
          {activeTab === 'detail' && (
            <div>{product.description ? <div className="prose max-w-none text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: product.description }} /> : <p className="text-gray-400 text-center py-12">상품 상세 정보가 없습니다.</p>}</div>
          )}

          {activeTab === 'reviews' && (
            <div>
              {reviewsLoading ? <div className="flex justify-center py-12"><span className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>
                : reviews.length === 0 ? <p className="text-center text-gray-400 py-12">첫 번째 리뷰를 작성해 주세요!</p>
                : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                      <span className="text-4xl font-bold">{avgRating.toFixed(1)}</span>
                      <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-5 w-5 ${i < Math.round(avgRating) ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`} />)}</div>
                    </div>
                    {reviews.map((review) => (
                      <div key={review.id} className="border-b pb-4">
                        <div className="flex justify-between mb-2">
                          <span className="font-medium text-sm">{review.userName}</span>
                          <span className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString('ko-KR')}</span>
                        </div>
                        <p className="text-sm text-gray-700">{review.content}</p>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

          {activeTab === 'qna' && (
            <div>
              <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                <h3 className="font-semibold mb-3">상품 문의하기</h3>
                <textarea className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" rows={4} placeholder="상품에 대해 궁금한 점을 문의해주세요." value={qnaQuestion} onChange={(e) => setQnaQuestion(e.target.value)} />
                <div className="flex items-center justify-between mt-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={qnaSecret} onChange={(e) => setQnaSecret(e.target.checked)} />비밀글
                  </label>
                  <button onClick={submitQuestion} disabled={qnaSubmitting || !qnaQuestion.trim()} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50">
                    {qnaSubmitting ? '등록 중...' : '문의 등록'}
                  </button>
                </div>
              </div>
              {qnaLoading ? <div className="flex justify-center py-12"><span className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>
                : qnaList.length === 0 ? <p className="text-center text-gray-400 py-12">등록된 문의가 없습니다.</p>
                : <div className="space-y-4">{qnaList.map((qna) => <QnAItem key={qna.id} qna={qna} />)}</div>}
            </div>
          )}

          {activeTab === 'shipping' && (
            <div className="space-y-4 text-sm text-gray-700">
              <div>
                <h3 className="font-bold mb-2">배송 안내</h3>
                <ul className="space-y-1 list-disc list-inside text-gray-600">
                  <li>배송 비용: 3,000원 (50,000원 이상 무료)</li>
                  <li>배송 기간: 결제 후 1~3 영업일</li>
                </ul>
              </div>
              <hr />
              <div>
                <h3 className="font-bold mb-2">교환 / 반품 안내</h3>
                <ul className="space-y-1 list-disc list-inside text-gray-600">
                  <li>교환/반품 기간: 상품 수령 후 7일 이내</li>
                  <li>상품 불량/오배송 시: 무료 교환 또는 환불</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QnAItem({ qna }: { qna: QnA }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-xl overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50">
        <span className="shrink-0 text-blue-600 font-bold text-sm">Q</span>
        <div className="flex-1">
          <p className="text-sm font-medium">{qna.isSecret ? '🔒 비밀글입니다.' : qna.question}</p>
          <p className="text-xs text-gray-400 mt-0.5">{qna.userName} · {new Date(qna.createdAt).toLocaleDateString('ko-KR')}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && (
        <div className="p-4 bg-blue-50 border-t">
          {qna.answer ? (
            <div className="flex gap-3">
              <span className="text-red-600 font-bold text-sm">A</span>
              <p className="text-sm text-gray-700">{qna.answer}</p>
            </div>
          ) : <p className="text-sm text-gray-400">아직 답변이 등록되지 않았습니다.</p>}
        </div>
      )}
    </div>
  );
}
