import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PageSection } from '@/components/theme/PageSection';
import {
  getProductBySlug,
  getProductOptions,
  getProductVariants,
  findVariantByOptions,
  type ProductOption,
  type ProductVariant,
} from '@/services/products';
import { addToCart } from '@/services/cart';
import { useCartStore } from '@/store/cart';
import {
  getUserLevel,
  getProductLevelPrices,
  calculateLevelPrice,
  type UserLevel,
  type ProductLevelPrice,
} from '@/services/memberLevel';
import {
  getQuantityDiscounts,
  getActiveTimeSale,
  calculateFinalPrice,
  formatRemainingTime,
  type QuantityDiscount,
  type TimeSale,
} from '@/services/discounts';
import {
  getRelatedProducts,
  getProductSets,
  getProductGifts,
  type RelatedProduct,
  type ProductSet,
  type ProductGift,
} from '@/services/relatedProducts';
import { requestStockAlert } from '@/services/stockAlert';
import { addToRecentlyViewed } from '@/services/recentlyViewed';
import { dispatchThemeEvent } from '@/lib/theme';
import { RecentlyViewed } from '@/components/recently-viewed';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { getSystemSetting } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Minus, Plus, ShoppingCart, Zap, ArrowLeft, Check, Star, ChevronDown, ChevronUp, Heart, AlertCircle, Crown } from 'lucide-react';

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
  regularPrice: number;
  salePrice: number;
  description?: string;
  summary?: string;
  stockQuantity: number;
  hasOptions?: boolean;
  images?: { id: string; url: string; alt?: string; isPrimary: boolean; sortOrder: number }[];
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
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  // 상품 옵션 관련 state
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // 회원 등급 가격 관련 state
  const [useLevels, setUseLevels] = useState(true);
  const [userLevel, setUserLevel] = useState<UserLevel | null>(null);
  const [levelPrices, setLevelPrices] = useState<ProductLevelPrice[]>([]);

  // 할인 관련 state
  const [quantityDiscounts, setQuantityDiscounts] = useState<QuantityDiscount[]>([]);
  const [timeSale, setTimeSale] = useState<TimeSale | null>(null);
  const [remainingTime, setRemainingTime] = useState<number>(0);

  // 관련 상품 관련 state
  const [relatedProducts, setRelatedProducts] = useState<RelatedProduct[]>([]);
  const [productSets, setProductSets] = useState<ProductSet[]>([]);
  const [productGifts, setProductGifts] = useState<ProductGift[]>([]);

  // 재고 알림 state
  const [stockAlertEmail, setStockAlertEmail] = useState('');
  const [stockAlertLoading, setStockAlertLoading] = useState(false);
  const [showStockAlertForm, setShowStockAlertForm] = useState(false);

  useEffect(() => {
    if (!slug) return;
    getProductBySlug(slug)
      .then((data) => {
        if (!data) setNotFound(true);
        else {
          setProduct(data as unknown as Product);
          // 최근 본 상품에 추가
          addToRecentlyViewed(data.id);
          // 테마 이벤트 디스패치
          dispatchThemeEvent('product-view', {
            productId: data.id,
            productName: data.name,
            slug: data.slug,
            price: data.salePrice ?? data.regularPrice,
          });
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!user || !product) return;
    const supabase = createClient();
    supabase
      .from('user_wishlist')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', product.id)
      .maybeSingle()
      .then(({ data }) => setIsWishlisted(!!data));
  }, [user, product]);

  useEffect(() => {
    getSystemSetting<boolean>('use_user_levels').then(val => {
      setUseLevels(val !== false);
    });
  }, []);

  // 회원 등급 정보 로드
  useEffect(() => {
    if (!useLevels || !user) {
      setUserLevel(null);
      return;
    }
    getUserLevel(user.id).then(setUserLevel);
  }, [user, useLevels]);

  // 상품 등급별 가격 로드
  useEffect(() => {
    if (!product || !useLevels) {
      setLevelPrices([]);
      return;
    }
    getProductLevelPrices(product.id).then(setLevelPrices);
  }, [product, useLevels]);

  // 수량별 할인 및 타임세일 로드
  useEffect(() => {
    if (!product) return;
    getQuantityDiscounts(product.id).then(setQuantityDiscounts);
    getActiveTimeSale(product.id).then((sale) => {
      setTimeSale(sale);
      if (sale) {
        setRemainingTime(new Date(sale.endsAt).getTime() - Date.now());
      }
    });
  }, [product]);

  // 타임세일 카운트다운
  useEffect(() => {
    if (!timeSale || remainingTime <= 0) return;
    const timer = setInterval(() => {
      const newRemaining = new Date(timeSale.endsAt).getTime() - Date.now();
      if (newRemaining <= 0) {
        setTimeSale(null);
        setRemainingTime(0);
        clearInterval(timer);
      } else {
        setRemainingTime(newRemaining);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [timeSale]);

  // 관련 상품, 세트, 사은품 로드
  useEffect(() => {
    if (!product) return;
    getRelatedProducts(product.id).then(setRelatedProducts);
    getProductSets(product.id).then(setProductSets);
    getProductGifts(product.id).then(setProductGifts);
  }, [product]);

  // 상품 옵션 로드
  useEffect(() => {
    if (!product || !product.hasOptions) return;

    setOptionsLoading(true);
    Promise.all([
      getProductOptions(product.id),
      getProductVariants(product.id),
    ])
      .then(([opts, vars]) => {
        setOptions(opts);
        setVariants(vars);

        // 첫 번째 옵션값으로 기본 선택
        if (opts.length > 0) {
          const defaultSelections: Record<string, string> = {};
          opts.forEach((opt) => {
            if (opt.values.length > 0) {
              defaultSelections[opt.id] = opt.values[0].id;
            }
          });
          setSelectedOptions(defaultSelections);
        }
      })
      .catch((err) => console.error('Failed to load options:', err))
      .finally(() => setOptionsLoading(false));
  }, [product]);

  // 선택된 옵션으로 variant 찾기
  useEffect(() => {
    if (variants.length === 0 || Object.keys(selectedOptions).length === 0) {
      setSelectedVariant(null);
      return;
    }

    const variant = findVariantByOptions(variants, selectedOptions);
    setSelectedVariant(variant);
  }, [selectedOptions, variants]);

  function handleOptionSelect(optionId: string, valueId: string) {
    setSelectedOptions((prev) => ({
      ...prev,
      [optionId]: valueId,
    }));
  }

  useEffect(() => {
    if (!slug) return;
    const supabase = createClient();
    async function loadReviews() {
      setReviewsLoading(true);
      try {
        const { data: prod } = await supabase.from('products').select('id').eq('slug', slug).single();
        if (!prod) { setReviews([]); setReviewsLoading(false); return; }
        const { data } = await supabase.from('reviews').select('*, users(name)').eq('product_id', prod.id).eq('is_visible', true);
        setReviews(data?.map((r: any) => ({ ...r, userName: r.users?.name || '익명' })) || []);
      } catch { setReviews([]); } finally { setReviewsLoading(false); }
    }
    async function loadQna() {
      setQnaLoading(true);
      try {
        const { data: prod2 } = await supabase.from('products').select('id').eq('slug', slug).single();
        if (!prod2) { setQnaList([]); setQnaLoading(false); return; }
        const { data } = await supabase.from('product_qna').select('*, users(name)').eq('product_id', prod2.id);
        setQnaList(data?.map((q: any) => ({ ...q, userName: q.users?.name || '익명' })) || []);
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

    // 옵션 상품인 경우 variant 선택 필수
    if (product.hasOptions && options.length > 0 && !selectedVariant) {
      showToast('옵션을 선택해주세요.', 'error');
      return;
    }

    setCartLoading(true);
    try {
      if (user) {
        // 로그인 사용자: DB 장바구니
        await addToCart(user.id, product.id, quantity, selectedVariant?.id);
      } else {
        // 비로그인: 로컬 장바구니 (Zustand)
        useCartStore.getState().addItem(product as any, quantity);
      }
      showToast('장바구니에 담겼습니다!', 'success');
      dispatchThemeEvent('add-to-cart', {
        productId: product.id,
        productName: product.name,
        quantity,
        price: product.salePrice ?? product.regularPrice,
        variantId: selectedVariant?.id ?? null,
      });
    } catch {
      showToast('장바구니 담기 중 오류가 발생했습니다.', 'error');
    } finally {
      setCartLoading(false);
    }
  }

  async function handleStockAlert() {
    if (!product || !stockAlertEmail) return;
    setStockAlertLoading(true);
    try {
      const result = await requestStockAlert(product.id, stockAlertEmail, selectedVariant?.id);
      showToast(result.message, result.success ? 'success' : 'error');
      if (result.success) {
        setShowStockAlertForm(false);
        setStockAlertEmail('');
      }
    } catch {
      showToast('재고 알림 신청에 실패했습니다.', 'error');
    } finally {
      setStockAlertLoading(false);
    }
  }

  async function handleWishlist() {
    if (!product) return;
    if (!user) { navigate('/auth/login'); return; }
    setWishlistLoading(true);
    const supabase = createClient();
    try {
      if (isWishlisted) {
        await supabase.from('user_wishlist').delete().eq('user_id', user.id).eq('product_id', product.id);
        setIsWishlisted(false);
        showToast('찜 목록에서 삭제되었습니다.', 'success');
      } else {
        await supabase.from('user_wishlist').insert({ user_id: user.id, product_id: product.id });
        setIsWishlisted(true);
        showToast('찜 목록에 추가되었습니다.', 'success');
      }
    } catch {
      showToast('오류가 발생했습니다.', 'error');
    } finally {
      setWishlistLoading(false);
    }
  }

  async function handleBuyNow() {
    if (!product) return;

    // 옵션 상품인 경우 variant 선택 필수
    if (product.hasOptions && options.length > 0 && !selectedVariant) {
      showToast('옵션을 선택해주세요.', 'error');
      return;
    }

    setBuyLoading(true);
    try {
      if (user) {
        await addToCart(user.id, product.id, quantity, selectedVariant?.id);
      } else {
        useCartStore.getState().addItem(product as any, quantity);
      }
      // 바로 구매는 로그인 필요 (결제를 위해)
      if (!user) { navigate('/auth/login'); return; }
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
      const { data: prod3 } = await supabase.from('products').select('id').eq('slug', slug).single();
      if (!prod3) { showToast('상품을 찾을 수 없습니다.', 'error'); return; }
      const { error } = await supabase.from('product_qna').insert({
        product_id: prod3.id,
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

  // variant 변경 시 quantity 조정
  useEffect(() => {
    const stock = selectedVariant?.stockQuantity ?? product?.stockQuantity ?? 0;
    if (stock > 0 && quantity > stock) {
      setQuantity(stock);
    }
  }, [selectedVariant, product, quantity]);

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

  // 옵션 상품일 경우 variant 기준, 아니면 기본 상품 기준
  const hasProductOptions = product.hasOptions && options.length > 0;
  const additionalPrice = selectedVariant?.additionalPrice || 0;
  const baseSalePrice = product.salePrice + additionalPrice;
  const finalRegularPrice = product.regularPrice + additionalPrice;

  // 1. 회원 등급 가격 적용
  const levelPriceResult = calculateLevelPrice(baseSalePrice, userLevel, levelPrices);
  const priceAfterLevel = levelPriceResult.finalPrice;
  const levelDiscountApplied = levelPriceResult.discountType !== 'none';

  // 2. 타임세일 및 수량별 할인 적용
  const discountResult = calculateFinalPrice(priceAfterLevel, quantity, timeSale, quantityDiscounts);
  const finalSalePrice = discountResult.unitPrice;
  const hasTimeSale = discountResult.appliedTimeSale !== null;
  const hasQuantityDiscount = discountResult.appliedQuantityDiscount !== null;

  const hasDiscount = finalRegularPrice > finalSalePrice;
  const discountPercent = hasDiscount ? Math.round(((finalRegularPrice - finalSalePrice) / finalRegularPrice) * 100) : 0;

  // 이미지: variant 이미지가 있으면 우선 사용
  const variantImage = selectedVariant?.imageUrl;
  const primaryImage = product.images?.find((img) => img.isPrimary) || product.images?.[0];
  const imageUrl = variantImage || primaryImage?.url || '/placeholder.png';

  // 재고: variant가 있으면 variant 재고, 없으면 기본 재고
  const currentStock = hasProductOptions && selectedVariant
    ? selectedVariant.stockQuantity
    : product.stockQuantity;
  const isSoldOut = currentStock === 0;

  // 옵션 선택이 완료되었는지 확인
  const isOptionSelectionComplete = !hasProductOptions || (options.length === Object.keys(selectedOptions).length && selectedVariant !== null);
  const isVariantUnavailable = hasProductOptions && options.length === Object.keys(selectedOptions).length && selectedVariant === null;

  function changeQuantity(delta: number) {
    setQuantity((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (next > currentStock) return currentStock;
      return next;
    });
  }

  return (
    <>
      <PageSection id="product-detail" />
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
          <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.png'; }} />
          {isSoldOut && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="rounded-lg bg-black/70 px-6 py-2 text-lg font-bold text-white">품절</span>
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <h1 className="mb-4 text-3xl font-bold">{product.name}</h1>
          <div className="mb-6">
            {/* 타임세일 배너 */}
            {hasTimeSale && timeSale && (
              <div className="mb-3 flex items-center justify-between rounded-lg bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3 text-white">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  <span className="font-bold">{timeSale.name || '타임세일'}</span>
                  <span className="rounded bg-white/20 px-2 py-0.5 text-sm">
                    {timeSale.discountType === 'percent' ? `${timeSale.discountValue}% 할인` : `${formatCurrency(timeSale.discountValue)} 할인`}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-80">남은 시간</p>
                  <p className="font-mono font-bold">{formatRemainingTime(remainingTime)}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold">{formatCurrency(finalSalePrice)}</span>
              {hasDiscount && (
                <>
                  <span className="text-xl text-gray-500 line-through">{formatCurrency(finalRegularPrice)}</span>
                  <span className="rounded-md bg-red-500 px-2 py-1 text-sm font-bold text-white">{discountPercent}% OFF</span>
                </>
              )}
            </div>

            {/* 수량별 할인 안내 */}
            {quantityDiscounts.length > 0 && (
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="mb-2 text-sm font-semibold text-blue-800">수량별 추가 할인</p>
                <div className="flex flex-wrap gap-2">
                  {quantityDiscounts.map((d) => (
                    <span
                      key={d.id}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        hasQuantityDiscount && discountResult.appliedQuantityDiscount?.id === d.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-blue-700 border border-blue-300'
                      }`}
                    >
                      {d.minQuantity}개 이상: {d.discountType === 'percent' ? `${d.discountValue}%` : formatCurrency(d.discountValue)} 할인
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 회원 등급 할인 표시 */}
            {useLevels && levelDiscountApplied && userLevel && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-2">
                <Crown className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-purple-700">
                  <span className="font-semibold">{userLevel.name}</span> 등급 혜택 적용
                  {levelPriceResult.discountType === 'level_discount' && (
                    <span> ({levelPriceResult.discountRate}% 할인)</span>
                  )}
                </span>
              </div>
            )}
            {useLevels && !user && (
              <p className="mt-2 text-sm text-gray-500">
                <Link to="/auth/login" className="text-blue-600 hover:underline">로그인</Link>하시면 회원 등급 혜택을 받으실 수 있습니다.
              </p>
            )}
            {additionalPrice > 0 && (
              <p className="mt-1 text-sm text-gray-500">
                (기본가 {formatCurrency(product.salePrice)} + 옵션 {formatCurrency(additionalPrice)})
              </p>
            )}
          </div>

          {/* 상품 옵션 선택 UI */}
          {hasProductOptions && (
            <div className="mb-6 space-y-4">
              {optionsLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                  옵션 로딩 중...
                </div>
              ) : (
                options.map((option) => (
                  <div key={option.id}>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      {option.name}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {option.values.map((value) => {
                        const isSelected = selectedOptions[option.id] === value.id;
                        return (
                          <button
                            key={value.id}
                            onClick={() => handleOptionSelect(option.id, value.id)}
                            className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            {value.value}
                            {value.additionalPrice > 0 && (
                              <span className="ml-1 text-xs text-gray-500">
                                (+{formatCurrency(value.additionalPrice)})
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}

              {/* 선택된 옵션 조합이 없는 경우 경고 */}
              {isVariantUnavailable && (
                <div className="flex items-center gap-2 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                  <AlertCircle className="h-4 w-4" />
                  선택하신 옵션 조합은 현재 판매하지 않습니다.
                </div>
              )}

              {/* 선택된 variant 정보 */}
              {selectedVariant && (
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">선택:</span>{' '}
                    {selectedVariant.optionValues.map((ov) => ov.valueName).join(' / ')}
                  </p>
                  {selectedVariant.sku && (
                    <p className="text-xs text-gray-500">SKU: {selectedVariant.sku}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mb-6 border-t border-b py-4">
            <div className="mb-2 flex justify-between">
              <span className="text-gray-600">배송비</span>
              <span>3,000원 (50,000원 이상 무료)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">재고</span>
              <span className={isSoldOut ? 'text-red-500 font-medium' : ''}>{isSoldOut ? '품절' : `${currentStock}개`}</span>
            </div>
          </div>

          {product.description && (
            <div className="mb-6">
              <h2 className="mb-3 text-lg font-semibold">상품 설명</h2>
              <p className="whitespace-pre-wrap text-gray-600 leading-relaxed">{product.description}</p>
            </div>
          )}

          {!isSoldOut && isOptionSelectionComplete && (
            <div className="mb-6">
              <p className="mb-2 text-sm font-medium text-gray-700">수량</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-md border">
                  <button className="flex h-10 w-10 items-center justify-center hover:bg-gray-50 disabled:opacity-50" onClick={() => changeQuantity(-1)} disabled={quantity <= 1}>
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center text-sm font-medium">{quantity}</span>
                  <button className="flex h-10 w-10 items-center justify-center hover:bg-gray-50 disabled:opacity-50" onClick={() => changeQuantity(1)} disabled={quantity >= currentStock}>
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <span className="text-sm text-gray-500">최대 {currentStock}개</span>
              </div>
              <p className="mt-2 text-sm font-medium text-gray-700">합계: <span className="text-lg font-bold text-blue-600">{formatCurrency(finalSalePrice * quantity)}</span></p>
            </div>
          )}

          {/* 품절 시 재고 알림 */}
          {isSoldOut && isOptionSelectionComplete && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="mb-2 font-semibold text-red-800">현재 품절된 상품입니다</p>
              {!showStockAlertForm ? (
                <button
                  onClick={() => setShowStockAlertForm(true)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  재입고 알림 신청하기 →
                </button>
              ) : (
                <div className="mt-3 space-y-2">
                  <input
                    type="email"
                    value={stockAlertEmail}
                    onChange={(e) => setStockAlertEmail(e.target.value)}
                    placeholder="이메일 주소 입력"
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleStockAlert}
                      disabled={stockAlertLoading || !stockAlertEmail}
                      className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {stockAlertLoading ? '신청 중...' : '알림 신청'}
                    </button>
                    <button
                      onClick={() => setShowStockAlertForm(false)}
                      className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 사은품 안내 */}
          {productGifts.length > 0 && (
            <div className="mb-6 rounded-xl border-2 border-dashed border-green-300 bg-green-50 p-4">
              <p className="mb-2 font-semibold text-green-800">🎁 사은품 증정</p>
              {productGifts.map((gift) => (
                <div key={gift.id} className="flex items-center gap-3">
                  {gift.giftProduct.imageUrl && (
                    <img src={gift.giftProduct.imageUrl} alt={gift.giftProduct.name} className="h-12 w-12 rounded object-cover" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-green-900">{gift.giftProduct.name}</p>
                    {gift.minOrderAmount > 0 && (
                      <p className="text-xs text-green-700">{formatCurrency(gift.minOrderAmount)} 이상 구매 시</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 세트 상품 안내 */}
          {productSets.length > 0 && (
            <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <p className="mb-3 font-semibold text-orange-800">📦 세트 구매 할인</p>
              {productSets.map((set) => (
                <div key={set.id} className="rounded-lg bg-white p-3">
                  <p className="font-medium text-sm">{set.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {set.products.slice(0, 3).map((p) => (
                      <Link key={p.id} to={`/products/${p.slug}`} className="text-xs text-blue-600 hover:underline">
                        {p.name}
                      </Link>
                    ))}
                    {set.products.length > 3 && <span className="text-xs text-gray-500">외 {set.products.length - 3}개</span>}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-gray-500 line-through">{formatCurrency(set.totalPrice)}</span>
                    <span className="text-sm font-bold text-orange-600">{formatCurrency(set.setPrice)}</span>
                    <span className="rounded bg-orange-500 px-1.5 py-0.5 text-xs font-bold text-white">
                      {set.discountType === 'percent' ? `${set.discountValue}%` : formatCurrency(set.discountValue)} 할인
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-auto flex gap-3">
            <Button size="lg" className="flex-1" onClick={handleAddToCart} disabled={isSoldOut || !isOptionSelectionComplete || isVariantUnavailable || cartLoading || buyLoading}>
              {cartLoading ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />담는 중...</span>
                : <span className="flex items-center gap-2"><ShoppingCart className="h-4 w-4" />{isSoldOut ? '품절' : hasProductOptions && !isOptionSelectionComplete ? '옵션 선택' : '장바구니 담기'}</span>}
            </Button>
            <Button size="lg" variant="outline" className="flex-1" onClick={handleBuyNow} disabled={isSoldOut || !isOptionSelectionComplete || isVariantUnavailable || cartLoading || buyLoading}>
              {buyLoading ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />처리 중...</span>
                : <span className="flex items-center gap-2"><Zap className="h-4 w-4" />바로 구매</span>}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleWishlist}
              disabled={wishlistLoading}
              className={isWishlisted ? 'text-red-500 border-red-300 hover:bg-red-50' : ''}
            >
              <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
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

      {/* 관련 상품 */}
      {relatedProducts.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-6 text-xl font-bold">관련 상품</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {relatedProducts.map((p) => (
              <Link key={p.id} to={`/products/${p.slug}`} className="group">
                <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">이미지 없음</div>
                  )}
                </div>
                <h3 className="mt-2 line-clamp-2 text-sm font-medium group-hover:text-blue-600">{p.name}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-bold">{formatCurrency(p.salePrice)}</span>
                  {p.regularPrice > p.salePrice && (
                    <span className="text-sm text-gray-400 line-through">{formatCurrency(p.regularPrice)}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 최근 본 상품 */}
      <div className="mt-12">
        <h2 className="mb-6 text-xl font-bold">최근 본 상품</h2>
        <RecentlyViewed currentProductId={product.id} maxItems={10} layout="horizontal" />
      </div>
    </div>
    <PageSection id="product-detail-bottom" />
    </>
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
