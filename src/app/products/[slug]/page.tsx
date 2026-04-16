import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { PageSection } from '@/components/theme/PageSection';
import {
  getProductBySlug,
  getProductOptions,
  getProductVariants,
  findVariantByOptions,
  OPTION_NONE_VALUE_ID,
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
  type RelatedProduct,
  type ProductSet,
} from '@/services/relatedProducts';
import { getGiftSets, getApplicableFreeCount, isGiftAddDisabled, resolveAutoGifts, type GiftSet, type GiftSelection, type AutoGiftResult } from '@/services/giftSets';
import { getBundleItems, getEffectiveBundleStock, type BundleItem } from '@/services/bundles';
import { requestStockAlert } from '@/services/stockAlert';
import { addToRecentlyViewed } from '@/services/recentlyViewed';
import { dispatchThemeEvent } from '@/lib/theme';
import { RecentlyViewed } from '@/components/recently-viewed';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { getSystemSetting } from '@/lib/permissions';
import { getSetting } from '@/services/settings';
import { Button } from '@/components/ui/button';
import { formatCurrency, getContrastColor } from '@/lib/utils';
import { Minus, Plus, ShoppingCart, Zap, ArrowLeft, Check, Star, ChevronDown, ChevronUp, Heart, AlertCircle, Crown, ThumbsUp, PenLine } from 'lucide-react';

interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  content: string;
  createdAt: string;
  images: string[];
  likeCount: number;
  isBest: boolean;
  adminReply: string | null;
  adminRepliedAt: string | null;
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
  productType?: 'single' | 'bundle';
  bundleDescription?: string | null;
  showStock?: boolean;
  showGiftStock?: boolean;
  minPurchaseQuantity?: number | null;
  maxPurchaseQuantity?: number | null;
  shippingType?: string;
  shippingFee?: number | null;
  shippingNotice?: string | null;
  returnNotice?: string | null;
  images?: { id: string; url: string; alt?: string; isPrimary: boolean; sortOrder: number }[];
}

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [cartLoading, setCartLoading] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'detail' | 'reviews' | 'qna' | 'shipping'>('detail');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [likedReviewIds, setLikedReviewIds] = useState<Set<string>>(new Set());
  const [likingId, setLikingId] = useState<string | null>(null);
  const [qnaList, setQnaList] = useState<QnA[]>([]);
  const [qnaCount, setQnaCount] = useState<number>(0);
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

  // 묶음상품 / 자동증정 state
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [bundleEffectiveStock, setBundleEffectiveStock] = useState<number | null>(null);
  const [autoGifts, setAutoGifts] = useState<AutoGiftResult[]>([]);

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
  const [giftSets, setGiftSets] = useState<GiftSet[]>([]);
  // 선택 모드 사은품 선택 상태: { [giftSetId]: GiftSelection[] }
  const [giftSelections, setGiftSelections] = useState<Record<string, GiftSelection[]>>({});

  // 재고 알림 state
  const [stockAlertEmail, setStockAlertEmail] = useState('');
  const [stockAlertLoading, setStockAlertLoading] = useState(false);
  const [showStockAlertForm, setShowStockAlertForm] = useState(false);

  // 배송/환불 안내 state
  const [defaultShippingNotice, setDefaultShippingNotice] = useState('');
  const [defaultReturnNotice, setDefaultReturnNotice] = useState('');

  useEffect(() => {
    getSetting('default_shipping_notice').then(setDefaultShippingNotice);
    getSetting('default_return_notice').then(setDefaultReturnNotice);
  }, []);

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
    if (!product) return;
    const supabase = createClient();
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', product.id)
      .eq('is_visible', true)
      .then(({ count }) => setReviewCount(count ?? 0));
  }, [product]);

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

  // Q&A 카운트 (탭에 표시용 — 탭 진입 전에도 보이도록)
  useEffect(() => {
    if (!product) return;
    const supabase = createClient();
    supabase
      .from('product_qna')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', product.id)
      .then(({ count }) => setQnaCount(count ?? 0));
  }, [product]);

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
    getGiftSets(product.id).then((sets) => {
      setGiftSets(sets);
      const initSelections: Record<string, GiftSelection[]> = {};
      sets.forEach((s) => { initSelections[s.id] = []; });
      setGiftSelections(initSelections);
    });
    // 묶음상품이면 구성 아이템 + 실효 재고 로드
    if (product.productType === 'bundle') {
      getBundleItems(product.id).then(setBundleItems);
      getEffectiveBundleStock(product.id).then(setBundleEffectiveStock);
    }
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

        // 필수 옵션: 첫 번째 값 기본 선택, 선택 옵션: "선택 안 함" 기본 선택
        if (opts.length > 0) {
          const defaultSelections: Record<string, string> = {};
          opts.forEach((opt) => {
            if (opt.isRequired) {
              if (opt.values.length > 0) defaultSelections[opt.id] = opt.values[0].id;
            } else {
              defaultSelections[opt.id] = OPTION_NONE_VALUE_ID;
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
        const { data } = await supabase
          .from('reviews')
          .select('id, user_id, rating, content, created_at, like_count, is_best, admin_reply, admin_replied_at, users(name), review_images(url, sort_order)')
          .eq('product_id', prod.id)
          .eq('is_visible', true)
          .order('is_best', { ascending: false })
          .order('created_at', { ascending: false });
        const mapped = (data || []).map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          userName: r.users?.name || '익명',
          rating: r.rating,
          content: r.content,
          createdAt: r.created_at,
          likeCount: r.like_count ?? 0,
          isBest: r.is_best ?? false,
          adminReply: r.admin_reply || null,
          adminRepliedAt: r.admin_replied_at || null,
          images: (r.review_images || [])
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((img: any) => img.url),
        }));
        setReviews(mapped);
        setReviewCount(mapped.length);
        // 로그인 사용자의 좋아요 목록 조회
        if (user && mapped.length > 0) {
          const ids = mapped.map((r: any) => r.id);
          const { data: likes } = await supabase
            .from('review_likes')
            .select('review_id')
            .eq('user_id', user.id)
            .in('review_id', ids);
          setLikedReviewIds(new Set((likes || []).map((l: any) => l.review_id)));
        }
      } catch { setReviews([]); } finally { setReviewsLoading(false); }
    }
    async function loadQna() {
      setQnaLoading(true);
      try {
        const { data: prod2 } = await supabase.from('products').select('id').eq('slug', slug).single();
        if (!prod2) { setQnaList([]); setQnaLoading(false); return; }
        const { data } = await supabase.from('product_qna').select('*, users(name)').eq('product_id', prod2.id).order('created_at', { ascending: false });
        const mapped = (data || []).map((q: any) => ({
          id: q.id,
          userId: q.user_id,
          userName: q.users?.name || '익명',
          question: q.question,
          answer: q.answer,
          isSecret: q.is_secret,
          createdAt: q.created_at,
          answeredAt: q.answered_at,
        }));
        setQnaList(mapped);
        setQnaCount(mapped.length);
      } catch { setQnaList([]); } finally { setQnaLoading(false); }
    }
    if (activeTab === 'reviews' && reviews.length === 0) loadReviews();
    if (activeTab === 'qna' && qnaList.length === 0) loadQna();
  }, [activeTab, slug]);

  // URL 파라미터 처리: tab=reviews, write=1
  useEffect(() => {
    const tab = searchParams.get('tab');
    const write = searchParams.get('write');
    const orderItemId = searchParams.get('orderItemId');
    if (tab === 'reviews') setActiveTab('reviews');
    if (write === '1') {
      navigate(
        `/products/${slug}/reviews/new${orderItemId ? `?orderItemId=${orderItemId}` : ''}`,
        { replace: true },
      );
    }
  }, []);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
  }

  function validateGiftSelections(): boolean {
    for (const giftSet of giftSets) {
      if (giftSet.giftType !== 'select') continue;
      const freeCount = getApplicableFreeCount(giftSet.tiers, quantity);
      if (freeCount <= 0) continue;
      const selections = giftSelections[giftSet.id] ?? [];
      const totalSelected = selections.reduce((sum, s) => sum + s.quantity, 0);
      if (totalSelected < freeCount) {
        showToast(`사은품 "${giftSet.name}"에서 ${freeCount}개를 선택해주세요. (현재 ${totalSelected}개 선택)`, 'error');
        return false;
      }
    }
    return true;
  }

  async function handleAddToCart() {
    if (!product) return;

    // 옵션 상품인 경우 variant 선택 필수
    if (product.hasOptions && options.length > 0 && !selectedVariant) {
      showToast('옵션을 선택해주세요.', 'error');
      return;
    }

    // 사은품 선택 확인
    if (!validateGiftSelections()) return;

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

    // 사은품 선택 확인
    if (!validateGiftSelections()) return;

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
        setQnaCount((prev) => prev + 1);
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

  // 수량/gift set 변경 시 자동증정 재계산
  useEffect(() => {
    if (!product) return;
    const autoResults = resolveAutoGifts(giftSets, product.id, quantity);
    setAutoGifts(autoResults);
  }, [quantity, giftSets, product]);

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

  async function handleLikeToggle(reviewId: string) {
    if (!user) { navigate('/auth/login'); return; }
    if (likingId) return;
    setLikingId(reviewId);
    try {
      const supabase = createClient();
      const isLiked = likedReviewIds.has(reviewId);
      if (isLiked) {
        await supabase.from('review_likes').delete().eq('review_id', reviewId).eq('user_id', user.id);
        await supabase.from('reviews').update({ like_count: Math.max(0, (reviews.find(r => r.id === reviewId)?.likeCount ?? 1) - 1) }).eq('id', reviewId);
        setLikedReviewIds((prev) => { const next = new Set(prev); next.delete(reviewId); return next; });
        setReviews((prev) => prev.map((r) => r.id === reviewId ? { ...r, likeCount: Math.max(0, r.likeCount - 1) } : r));
      } else {
        await supabase.from('review_likes').insert({ review_id: reviewId, user_id: user.id });
        await supabase.from('reviews').update({ like_count: (reviews.find(r => r.id === reviewId)?.likeCount ?? 0) + 1 }).eq('id', reviewId);
        setLikedReviewIds((prev) => new Set([...prev, reviewId]));
        setReviews((prev) => prev.map((r) => r.id === reviewId ? { ...r, likeCount: r.likeCount + 1 } : r));
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    } finally {
      setLikingId(null);
    }
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

  // 재고: variant가 있으면 variant 재고, 번들이면 실효 재고, 없으면 기본 재고
  const bundleStockLoading = product.productType === 'bundle' && bundleEffectiveStock === null;
  const currentStock = hasProductOptions && selectedVariant
    ? selectedVariant.stockQuantity
    : product.productType === 'bundle' && bundleEffectiveStock !== null
      ? bundleEffectiveStock
      : product.stockQuantity;
  const isSoldOut = !bundleStockLoading && currentStock === 0;

  // 옵션 선택이 완료되었는지 확인 (필수 옵션만 체크)
  const requiredOptions = options.filter((opt) => opt.isRequired);
  const allRequiredSelected = requiredOptions.every(
    (opt) => selectedOptions[opt.id] && selectedOptions[opt.id] !== OPTION_NONE_VALUE_ID
  );
  const isOptionSelectionComplete = !hasProductOptions || (allRequiredSelected && selectedVariant !== null);
  const isVariantUnavailable = hasProductOptions && allRequiredSelected && selectedVariant === null;

  // variant 또는 상품 기본값에서 구매 수량 제한 결정
  const effectiveMin = selectedVariant?.minPurchaseQuantity ?? product?.minPurchaseQuantity ?? 1;
  const effectiveMax = selectedVariant?.maxPurchaseQuantity ?? product?.maxPurchaseQuantity ?? currentStock;
  const effectiveDailyLimit = selectedVariant?.dailyPurchaseLimit ?? null;

  function changeQuantity(delta: number) {
    setQuantity((prev) => {
      const next = prev + delta;
      if (next < effectiveMin) return effectiveMin;
      if (next > effectiveMax) return effectiveMax;
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
          {/* 하단 띠지 */}
          {product.activeBadgeText && !isSoldOut && (
            <div
              className="absolute bottom-0 left-0 right-0 py-1.5 text-center text-sm font-bold tracking-wide"
              style={{
                backgroundColor: product.activeBadgeColor ?? '#ef4444',
                color: getContrastColor(product.activeBadgeColor ?? '#ef4444'),
              }}
            >
              {product.activeBadgeText}
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
          {/* 묶음상품 구성 목록 */}
          {product.productType === 'bundle' && bundleItems.length > 0 && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="mb-3 text-sm font-semibold text-gray-700">이 상품의 구성</p>
              <div className="space-y-2">
                {bundleItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    {item.productImageUrl && (
                      <img src={item.productImageUrl} className="h-9 w-9 rounded object-cover border" />
                    )}
                    <span className="flex-1 text-sm">{item.productName}</span>
                    <span className="text-sm font-semibold text-gray-600">× {item.quantity}개</span>
                  </div>
                ))}
              </div>
              {product.bundleDescription && (
                <p className="mt-3 border-t border-gray-200 pt-3 text-sm text-gray-600 whitespace-pre-line">
                  {product.bundleDescription}
                </p>
              )}
            </div>
          )}

          {/* 자동증정 배지 */}
          {autoGifts.length > 0 && (
            <div className="mb-6 space-y-2">
              {autoGifts.map((gift) => (
                <div key={gift.giftSetId} className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
                  <span className="text-base">🎁</span>
                  <div className="text-sm text-green-800">
                    <span className="font-semibold">{gift.giftSetName}</span>
                    {' — '}
                    {gift.giftType === 'auto_same'
                      ? `동일 상품 ${gift.quantity}개 자동 증정`
                      : `${gift.giftProductName} ${gift.quantity}개 자동 증정`}
                  </div>
                </div>
              ))}
            </div>
          )}

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
                    <label className="mb-2 flex items-center gap-1 text-sm font-medium text-gray-700">
                      {option.name}
                      {!option.isRequired && (
                        <span className="text-xs font-normal text-gray-400">(선택)</span>
                      )}
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
              <span className={isSoldOut ? 'text-red-500 font-medium' : ''}>
                {isSoldOut ? '품절' : product.showStock !== false ? `${currentStock}개` : '재고 있음'}
              </span>
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
                  <button className="flex h-10 w-10 items-center justify-center hover:bg-gray-50 disabled:opacity-50" onClick={() => changeQuantity(-1)} disabled={quantity <= effectiveMin}>
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center text-sm font-medium">{quantity}</span>
                  <button className="flex h-10 w-10 items-center justify-center hover:bg-gray-50 disabled:opacity-50" onClick={() => changeQuantity(1)} disabled={quantity >= Math.min(effectiveMax, currentStock)}>
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-col text-sm text-gray-500">
                  {effectiveMin > 1 && <span>최소 {effectiveMin}개</span>}
                  {product.showStock !== false && <span>최대 {Math.min(effectiveMax, currentStock)}개</span>}
                  {effectiveDailyLimit && <span>1일 {effectiveDailyLimit}개 제한</span>}
                </div>
              </div>
              {/* 수량 할인 적용 시 가격 분해 표시 */}
              {hasQuantityDiscount && discountResult.appliedQuantityDiscount ? (
                <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-1">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>단가</span>
                    <span>{formatCurrency(priceAfterLevel)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-blue-700 font-medium">
                    <span>
                      수량 할인 ({discountResult.appliedQuantityDiscount.minQuantity}개 이상 —{' '}
                      {discountResult.appliedQuantityDiscount.discountType === 'percent'
                        ? `${discountResult.appliedQuantityDiscount.discountValue}%`
                        : formatCurrency(discountResult.appliedQuantityDiscount.discountValue)}{' '}
                      할인)
                    </span>
                    <span>−{formatCurrency(discountResult.quantityDiscount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold border-t border-blue-200 pt-1">
                    <span>할인 단가 × {quantity}개</span>
                    <span className="text-blue-700">{formatCurrency(finalSalePrice)} × {quantity}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>합계</span>
                    <span className="text-lg text-blue-700">{formatCurrency(finalSalePrice * quantity)}</span>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm font-medium text-gray-700">합계: <span className="text-lg font-bold text-blue-600">{formatCurrency(finalSalePrice * quantity)}</span></p>
              )}
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

          {/* 사은품 */}
          {giftSets.length > 0 && giftSets.map((giftSet) => {
            const freeCount = getApplicableFreeCount(giftSet.tiers, quantity);
            const hasActiveTier = freeCount > 0;
            const selections = giftSelections[giftSet.id] ?? [];
            const totalSelected = selections.reduce((s, g) => s + g.quantity, 0);

            // 해당 구매수량에 tier가 없으면 — 최소 tier 정보를 힌트로 표시
            const minTier = giftSet.tiers.length > 0
              ? giftSet.tiers.reduce((a, b) => a.minQuantity < b.minQuantity ? a : b)
              : null;

            function changeGiftQty(productId: string, delta: number) {
              setGiftSelections((prev) => {
                const cur = prev[giftSet.id] ?? [];
                const existing = cur.find((g) => g.giftProductId === productId);
                const newQty = (existing?.quantity ?? 0) + delta;
                if (newQty <= 0) {
                  return { ...prev, [giftSet.id]: cur.filter((g) => g.giftProductId !== productId) };
                }
                if (existing) {
                  return { ...prev, [giftSet.id]: cur.map((g) => g.giftProductId === productId ? { ...g, quantity: newQty } : g) };
                }
                return { ...prev, [giftSet.id]: [...cur, { giftProductId: productId, quantity: newQty }] };
              });
            }

            return (
              <div
                key={giftSet.id}
                className={`mb-4 rounded-xl border-2 border-dashed p-4 ${hasActiveTier ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50 opacity-70'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-blue-800">
                    🎁 {giftSet.name}
                    {!hasActiveTier && minTier && (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        ({minTier.minQuantity}개 이상 구매 시 선택 가능)
                      </span>
                    )}
                  </p>
                  {hasActiveTier && (
                    <span className={`text-sm font-bold ${totalSelected >= freeCount ? 'text-orange-600' : 'text-blue-600'}`}>
                      {totalSelected} / {freeCount}개 선택
                    </span>
                  )}
                </div>

                {/* 구간 안내 */}
                {giftSet.tiers.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {[...giftSet.tiers]
                      .sort((a, b) => a.minQuantity - b.minQuantity)
                      .map((tier) => (
                        <span
                          key={tier.id}
                          className={`rounded-full px-2 py-0.5 text-xs ${quantity >= tier.minQuantity ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'}`}
                        >
                          {tier.minQuantity}개 이상 → {tier.freeCount}개 선택
                        </span>
                      ))}
                  </div>
                )}

                {/* 진행 바 */}
                {hasActiveTier && (
                  <div className="mb-3 h-1.5 w-full rounded-full bg-gray-200">
                    <div
                      className={`h-1.5 rounded-full transition-all ${totalSelected >= freeCount ? 'bg-orange-400' : 'bg-blue-400'}`}
                      style={{ width: `${Math.min((totalSelected / freeCount) * 100, 100)}%` }}
                    />
                  </div>
                )}

                {/* 모든 사은품 품절 안내 (showGiftStock=true일 때만) */}
                {product.showGiftStock !== false && (() => {
                  const allItemsSoldOut = giftSet.items.length > 0 && giftSet.items.every((i) => i.giftProductStock === 0);
                  return allItemsSoldOut ? (
                    <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                      현재 모든 사은품이 품절되어 선택하실 수 없습니다.
                    </div>
                  ) : null;
                })()}

                <div className="space-y-2">
                  {giftSet.items.map((item) => {
                    const showGiftStock = product.showGiftStock !== false;
                    const isItemSoldOut = showGiftStock && item.giftProductStock === 0;
                    const selectedQty = selections.find((g) => g.giftProductId === item.giftProductId)?.quantity ?? 0;
                    const plusDisabled = !hasActiveTier || isGiftAddDisabled(freeCount, selections) || isItemSoldOut;
                    const minusDisabled = !hasActiveTier || selectedQty <= 0;

                    return (
                      <div key={item.id} className={`flex items-center gap-3 rounded-lg border bg-white p-2 ${isItemSoldOut ? 'opacity-50' : ''}`}>
                        {item.giftProductImageUrl && (
                          <img src={item.giftProductImageUrl} alt={item.giftProductName} className="h-10 w-10 rounded object-cover flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.giftProductName}</p>
                          {isItemSoldOut ? (
                            <p className="text-xs font-medium text-red-500">품절</p>
                          ) : (
                            <p className="text-xs text-gray-400">사은품 0원</p>
                          )}
                        </div>
                        {!isItemSoldOut && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              disabled={minusDisabled}
                              onClick={() => changeGiftQty(item.giftProductId, -1)}
                              className="flex h-7 w-7 items-center justify-center rounded border text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-sm font-medium">{selectedQty}</span>
                            <button
                              type="button"
                              disabled={plusDisabled}
                              onClick={() => changeGiftQty(item.giftProductId, 1)}
                              className="flex h-7 w-7 items-center justify-center rounded border text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {hasActiveTier && (
                  <p className="mt-2 text-xs text-gray-500">총 {freeCount}개까지 선택할 수 있습니다.</p>
                )}
              </div>
            );
          })}

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
          {([{ key: 'detail', label: '상품 상세' }, { key: 'reviews', label: `리뷰 (${reviewCount})` }, { key: 'qna', label: `Q&A (${qnaCount})` }, { key: 'shipping', label: '배송/환불 안내' }] as const).map((tab) => (
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
              {reviewsLoading ? (
                <div className="flex justify-center py-12">
                  <span className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 평점 요약 + 리뷰 작성 버튼 */}
                  <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl font-bold">{avgRating.toFixed(1)}</span>
                      <div>
                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-5 w-5 ${i < Math.round(avgRating) ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`} />
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">총 {reviewCount}개 리뷰</p>
                      </div>
                    </div>
                    {user ? (
                      <Link to={`/mypage/reviews`}>
                        <Button size="sm" variant="outline">
                          <PenLine className="mr-1.5 h-4 w-4" />리뷰 작성
                        </Button>
                      </Link>
                    ) : (
                      <Link to={`/auth/login?next=/products/${slug}`}>
                        <Button size="sm" variant="outline">
                          <PenLine className="mr-1.5 h-4 w-4" />로그인 후 작성
                        </Button>
                      </Link>
                    )}
                  </div>

                  {reviews.length === 0 ? (
                    <div className="py-12 text-center">
                      <Star className="mx-auto mb-3 h-10 w-10 text-gray-200" />
                      <p className="text-gray-400">첫 번째 리뷰를 작성해 주세요!</p>
                    </div>
                  ) : (
                    reviews.map((review) => (
                      <div key={review.id} className={`border-b pb-6 last:border-0 ${review.isBest ? 'rounded-xl border border-yellow-200 bg-yellow-50 p-4 mb-2' : ''}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{review.userName}</span>
                              {review.isBest && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-semibold text-white">
                                  <Star className="h-3 w-3 fill-white text-white" />
                                  베스트
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} className={`h-3.5 w-3.5 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`} />
                              ))}
                            </div>
                          </div>
                          <span className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString('ko-KR')}</span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">{review.content}</p>
                        {review.images.length > 0 && (
                          <div className="flex gap-2 flex-wrap mb-3">
                            {review.images.map((img, i) => (
                              <div key={i} className="h-20 w-20 overflow-hidden rounded-lg border bg-gray-100">
                                <img src={img} alt={`리뷰 이미지 ${i + 1}`} className="h-full w-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleLikeToggle(review.id)}
                          disabled={likingId === review.id}
                          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            likedReviewIds.has(review.id)
                              ? 'bg-blue-50 border-blue-300 text-blue-600'
                              : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                          }`}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                          도움돼요 {review.likeCount > 0 && <span>{review.likeCount}</span>}
                        </button>
                        {/* 판매자 답변 */}
                        {review.adminReply && (
                          <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
                            <p className="mb-1 text-xs font-semibold text-gray-500">판매자 답변</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.adminReply}</p>
                            {review.adminRepliedAt && (
                              <p className="mt-1 text-xs text-gray-400">
                                {new Date(review.adminRepliedAt).toLocaleDateString('ko-KR')}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'qna' && (
            <div>
              {/* 문의 작성 폼 */}
              {user ? (
                <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                  <h3 className="font-semibold mb-3">상품 문의하기</h3>
                  <textarea
                    className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    placeholder="상품에 대해 궁금한 점을 문의해주세요."
                    value={qnaQuestion}
                    onChange={(e) => setQnaQuestion(e.target.value)}
                  />
                  <div className="flex items-center justify-between mt-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={qnaSecret}
                        onChange={(e) => setQnaSecret(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 accent-blue-600"
                      />
                      <span className="text-gray-700">비밀글로 등록</span>
                      <span className="text-xs text-gray-400">(작성자 본인만 확인 가능)</span>
                    </label>
                    <button
                      onClick={submitQuestion}
                      disabled={qnaSubmitting || !qnaQuestion.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50"
                    >
                      {qnaSubmitting ? '등록 중...' : '문의 등록'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mb-6 p-5 bg-gray-50 rounded-xl text-center">
                  <p className="text-sm text-gray-500 mb-3">상품 문의는 로그인 후 이용하실 수 있습니다.</p>
                  <Link
                    to={`/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`}
                    className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-lg"
                  >
                    로그인하기
                  </Link>
                </div>
              )}
              {/* 문의 목록 */}
              {qnaLoading
                ? <div className="flex justify-center py-12"><span className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>
                : qnaList.length === 0
                  ? <p className="text-center text-gray-400 py-12">등록된 문의가 없습니다.</p>
                  : <div className="space-y-4">{qnaList.map((qna) => <QnAItem key={qna.id} qna={qna} currentUserId={user?.id} />)}</div>}
            </div>
          )}

          {activeTab === 'shipping' && (
            <div className="space-y-6 text-sm text-gray-700">
              {/* 배송 안내 */}
              <div>
                <h3 className="mb-3 font-bold text-gray-900">배송 안내</h3>
                {(() => {
                  const notice = product?.shippingNotice || defaultShippingNotice;
                  if (!notice) return <p className="text-gray-500">배송 안내가 없습니다.</p>;
                  const hasHtml = /<[a-z][\s\S]*>/i.test(notice);
                  return hasHtml ? (
                    <div className="prose prose-sm max-w-none text-gray-600" dangerouslySetInnerHTML={{ __html: notice }} />
                  ) : (
                    <p className="whitespace-pre-wrap text-gray-600">{notice}</p>
                  );
                })()}
              </div>
              <hr />
              {/* 환불·교환 안내 */}
              <div>
                <h3 className="mb-3 font-bold text-gray-900">교환 / 반품 안내</h3>
                {(() => {
                  const notice = product?.returnNotice || defaultReturnNotice;
                  if (!notice) return <p className="text-gray-500">환불·교환 안내가 없습니다.</p>;
                  const hasHtml = /<[a-z][\s\S]*>/i.test(notice);
                  return hasHtml ? (
                    <div className="prose prose-sm max-w-none text-gray-600" dangerouslySetInnerHTML={{ __html: notice }} />
                  ) : (
                    <p className="whitespace-pre-wrap text-gray-600">{notice}</p>
                  );
                })()}
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

function QnAItem({ qna, currentUserId }: { qna: QnA; currentUserId?: string }) {
  const [open, setOpen] = useState(false);
  const canView = !qna.isSecret || qna.userId === currentUserId;

  return (
    <div className="border rounded-xl overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50">
        <span className="shrink-0 text-blue-600 font-bold text-sm">Q</span>
        <div className="flex-1">
          <p className="text-sm font-medium">
            {qna.isSecret && <span className="mr-1">🔒</span>}
            {canView ? qna.question : '비밀글입니다.'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {canView ? qna.userName : '***'} · {qna.createdAt ? new Date(qna.createdAt).toLocaleDateString('ko-KR') : '-'}
          </p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && (
        <div className="p-4 bg-blue-50 border-t">
          {canView ? (
            qna.answer ? (
              <div className="flex gap-3">
                <span className="text-red-600 font-bold text-sm">A</span>
                <p className="text-sm text-gray-700">{qna.answer}</p>
              </div>
            ) : <p className="text-sm text-gray-400">아직 답변이 등록되지 않았습니다.</p>
          ) : (
            <p className="text-sm text-gray-400">비밀글입니다. 작성자만 확인할 수 있습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}
