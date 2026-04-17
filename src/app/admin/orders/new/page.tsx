import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import {
  ArrowLeft, Search, Plus, Minus, Trash2, User, Package, CreditCard, MapPin, Gift, X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createAdminOrder } from '@/services/orders';
import { getUserAddresses, type UserAddress } from '@/services/addresses';
import {
  getGiftSets, getApplicableFreeCount, resolveAutoGifts,
  type GiftSet, type GiftSetItem,
} from '@/services/giftSets';
import { openDaumPostcode } from '@/lib/daum-postcode';

// ── 인터페이스 ──────────────────────────────────────────────────────────────
interface FoundUser { id: string; name: string; email: string; phone: string; }
interface Category { id: string; name: string; parentId: string | null; depth: number; }
interface ProductResult { id: string; name: string; price: number; stock: number; }
interface VariantResult { id: string; optionText: string; price: number; additionalPrice: number; stock: number; }
interface EditItem {
  key: string;
  productId: string;
  variantId: string | null;
  productName: string;
  optionText: string;
  unitPrice: number;
  quantity: number;
}
interface AdminGiftSelection {
  giftProductId: string;
  giftProductName: string;
  variantId: string | null;
  optionText: string;
  quantity: number;
}

// ── 상수 ────────────────────────────────────────────────────────────────────
const STEP_LABELS = ['고객 정보', '상품 선택', '배송 · 결제'];
let _keySeq = 0;
function newKey() { return `k${++_keySeq}_${Date.now()}`; }

// ── 헬퍼 ────────────────────────────────────────────────────────────────────
async function loadVariantsForProduct(
  supabase: ReturnType<typeof createClient>,
  productId: string,
  basePrice: number,
): Promise<VariantResult[]> {
  const [{ data: variants }, { data: optRows }, { data: valRows }] = await Promise.all([
    supabase.from('product_variants').select('id, option_values, additional_price, stock_quantity')
      .eq('product_id', productId).eq('is_active', true),
    supabase.from('product_options').select('id, name').eq('product_id', productId),
    supabase.from('product_option_values').select('id, option_id, value'),
  ]);
  if (!variants || variants.length === 0) return [];
  const optMap = new Map((optRows ?? []).map((o: any) => [o.id, o.name]));
  const valMap = new Map((valRows ?? []).map((v: any) => [v.id, { optionId: v.option_id, value: v.value }]));
  return variants.map((v: any) => {
    const raw: { optionId: string; valueId: string }[] = v.option_values ?? [];
    const parts = raw
      .map((ov) => { const n = optMap.get(ov.optionId) ?? ''; const val = valMap.get(ov.valueId); return val ? `${n}: ${val.value}` : ''; })
      .filter(Boolean);
    return {
      id: v.id,
      optionText: parts.join(' / ') || v.id,
      price: basePrice + (v.additional_price ?? 0),
      additionalPrice: v.additional_price ?? 0,
      stock: v.stock_quantity ?? 0,
    };
  });
}

// ════════════════════════════════════════════════════════════════════════════
export default function AdminNewOrderPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [step, setStep]   = useState(0);
  const [saving, setSaving] = useState(false);

  // ── Step 0: 고객 ─────────────────────────────────────────────────────────
  const [userSearchQ, setUserSearchQ]         = useState('');
  const [userSearchResults, setUserSearchResults] = useState<FoundUser[]>([]);
  const [foundUser, setFoundUser]             = useState<FoundUser | null>(null);
  const [ordererName, setOrdererName]         = useState('');
  const [ordererPhone, setOrdererPhone]       = useState('');

  // ── Step 1: 상품 ─────────────────────────────────────────────────────────
  const [items, setItems] = useState<EditItem[]>([]);

  // 카테고리
  const [categories, setCategories]           = useState<Category[]>([]);
  const [selParentCatId, setSelParentCatId]   = useState('');
  const [selCatId, setSelCatId]               = useState('');

  // 상품 검색/선택
  const [productQ, setProductQ]               = useState('');
  const [productResults, setProductResults]   = useState<ProductResult[]>([]);
  const [selProduct, setSelProduct]           = useState<ProductResult | null>(null);
  const [variantResults, setVariantResults]   = useState<VariantResult[]>([]);

  // 사은품
  const [productGiftSets, setProductGiftSets] = useState<Record<string, GiftSet[]>>({});
  // key = `${itemKey}:${giftSetId}`
  const [giftSels, setGiftSels]               = useState<Record<string, AdminGiftSelection[]>>({});
  // key = giftProductId (variants cache)
  const [giftVariants, setGiftVariants]       = useState<Record<string, VariantResult[]>>({});
  const [giftModal, setGiftModal]             = useState<{
    itemKey: string; giftSetId: string; giftItem: GiftSetItem; freeCount: number;
  } | null>(null);

  // ── Step 2: 배송 · 결제 ───────────────────────────────────────────────────
  const [savedAddresses, setSavedAddresses]   = useState<UserAddress[]>([]);
  const [selAddrId, setSelAddrId]             = useState<string | 'new'>('new');
  const [sameAsOrderer, setSameAsOrderer]     = useState(true);
  const [recipientName, setRecipientName]     = useState('');
  const [recipientPhone, setRecipientPhone]   = useState('');
  const [postalCode, setPostalCode]           = useState('');
  const [address1, setAddress1]               = useState('');
  const [address2, setAddress2]               = useState('');
  const [shippingMessage, setShippingMessage] = useState('');
  const [paymentMethod, setPaymentMethod]     = useState('bank_transfer');
  const [discountAmount, setDiscountAmount]   = useState(0);
  const [shippingFeeManual, setShippingFeeManual] = useState(false);
  const [shippingFeeOverride, setShippingFeeOverride] = useState(0);
  const [adminMemo, setAdminMemo]             = useState('');
  const [initialStatus, setInitialStatus]     = useState<'pending' | 'paid'>('pending');
  const [baseFee, setBaseFee]                 = useState(3000);
  const [freeThreshold, setFreeThreshold]     = useState(50000);

  // ── 초기화 ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) navigate('/auth/login');
  }, [user, authLoading]);

  useEffect(() => {
    import('@/services/settings').then(({ getShippingSettings }) =>
      getShippingSettings().then(({ shippingFee, freeShippingThreshold }) => {
        setBaseFee(shippingFee);
        setFreeThreshold(freeShippingThreshold);
      })
    );
  }, []);

  useEffect(() => {
    supabase
      .from('product_categories')
      .select('id, name, parent_id, depth')
      .order('depth', { ascending: true })
      .order('sort_order', { ascending: true })
      .then(({ data }) =>
        setCategories(
          (data ?? []).map((c: any) => ({
            id: c.id, name: c.name, parentId: c.parent_id ?? null, depth: c.depth ?? 0,
          }))
        )
      );
  }, []);

  // ── 파생 상태 ────────────────────────────────────────────────────────────
  const parentCats  = categories.filter((c) => !c.parentId);
  const childCats   = selParentCatId ? categories.filter((c) => c.parentId === selParentCatId) : [];

  const purchaseSubtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const calcShippingFee  = shippingFeeManual ? shippingFeeOverride : purchaseSubtotal >= freeThreshold ? 0 : baseFee;
  const totalAmount      = Math.max(0, purchaseSubtotal + calcShippingFee - discountAmount);

  // ── 회원 검색 ────────────────────────────────────────────────────────────
  async function handleUserSearch() {
    if (!userSearchQ.trim()) return;
    const { data } = await supabase
      .from('users').select('id, name, email, phone')
      .or(`email.ilike.%${userSearchQ.trim()}%,phone.ilike.%${userSearchQ.trim()}%,name.ilike.%${userSearchQ.trim()}%`)
      .limit(8);
    setUserSearchResults((data ?? []).map((u: any) => ({ id: u.id, name: u.name ?? '', email: u.email ?? '', phone: u.phone ?? '' })));
  }

  async function selectUser(u: FoundUser) {
    setFoundUser(u); setOrdererName(u.name); setOrdererPhone(u.phone);
    setUserSearchResults([]); setUserSearchQ('');
    try {
      const addrs = await getUserAddresses(u.id);
      setSavedAddresses(addrs);
      const def = addrs.find((a) => a.isDefault) ?? addrs[0];
      if (def) { setSelAddrId(def.id); applyAddress(def); } else setSelAddrId('new');
    } catch { setSavedAddresses([]); setSelAddrId('new'); }
  }

  function applyAddress(addr: UserAddress) {
    setSameAsOrderer(false);
    setRecipientName(addr.recipientName); setRecipientPhone(addr.recipientPhone);
    setPostalCode(addr.postalCode); setAddress1(addr.address1); setAddress2(addr.address2 ?? '');
  }

  function handleSavedAddrSelect(id: string) {
    setSelAddrId(id);
    if (id === 'new') {
      setRecipientName(''); setRecipientPhone(''); setPostalCode(''); setAddress1(''); setAddress2(''); setSameAsOrderer(true);
    } else {
      const addr = savedAddresses.find((a) => a.id === id);
      if (addr) applyAddress(addr);
    }
  }

  function clearUser() {
    setFoundUser(null); setOrdererName(''); setOrdererPhone(''); setSavedAddresses([]); setSelAddrId('new');
  }

  // ── 상품 검색 ────────────────────────────────────────────────────────────
  async function handleProductSearch() {
    let q = supabase.from('products').select('id, name, sale_price, stock_quantity').eq('status', 'active');
    if (productQ.trim()) q = q.ilike('name', `%${productQ.trim()}%`);
    if (selCatId) {
      q = q.eq('category_id', selCatId);
    } else if (selParentCatId && childCats.length > 0) {
      q = q.in('category_id', childCats.map((c) => c.id));
    }
    const { data } = await q.limit(20);
    setProductResults((data ?? []).map((p: any) => ({ id: p.id, name: p.name, price: p.sale_price, stock: p.stock_quantity ?? 0 })));
    setSelProduct(null); setVariantResults([]);
  }

  async function handleProductSelect(p: ProductResult) {
    setSelProduct(p);
    const variants = await loadVariantsForProduct(supabase, p.id, p.price);
    if (variants.length === 0) {
      // 옵션 없음 → 바로 추가
      commitItem({ productId: p.id, variantId: null, productName: p.name, optionText: '', unitPrice: p.price, quantity: 1 });
    } else {
      setVariantResults(variants);
    }
  }

  function handleVariantSelect(v: VariantResult) {
    if (!selProduct) return;
    commitItem({ productId: selProduct.id, variantId: v.id, productName: selProduct.name, optionText: v.optionText, unitPrice: v.price, quantity: 1 });
  }

  function commitItem(data: Omit<EditItem, 'key'>) {
    const key = newKey();
    setItems((prev) => [...prev, { key, ...data }]);
    setSelProduct(null); setVariantResults([]); setProductResults([]); setProductQ('');
    // 사은품 세트 로드
    getGiftSets(data.productId).then((sets) =>
      setProductGiftSets((prev) => ({ ...prev, [data.productId]: sets }))
    );
  }

  function updateQty(key: string, delta: number) {
    setItems((prev) => prev.map((i) => i.key === key ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  }

  function updatePrice(key: string, price: number) {
    setItems((prev) => prev.map((i) => i.key === key ? { ...i, unitPrice: price } : i));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
    setGiftSels((prev) => {
      const next = { ...prev };
      Object.keys(next).filter((k) => k.startsWith(`${key}:`)).forEach((k) => delete next[k]);
      return next;
    });
  }

  // ── 사은품 관련 ──────────────────────────────────────────────────────────
  function giftSelKey(itemKey: string, giftSetId: string) { return `${itemKey}:${giftSetId}`; }

  function getSels(itemKey: string, giftSetId: string): AdminGiftSelection[] {
    return giftSels[giftSelKey(itemKey, giftSetId)] ?? [];
  }

  function selTotal(sels: AdminGiftSelection[]) { return sels.reduce((s, g) => s + g.quantity, 0); }

  async function handleGiftItemClick(
    itemKey: string, giftSetId: string, giftItem: GiftSetItem, freeCount: number,
  ) {
    const key     = giftSelKey(itemKey, giftSetId);
    const current = giftSels[key] ?? [];
    if (selTotal(current) >= freeCount) return;

    // 사은품 상품 variants 캐시 확인
    let variants = giftVariants[giftItem.giftProductId];
    if (variants === undefined) {
      variants = await loadVariantsForProduct(supabase, giftItem.giftProductId, 0);
      setGiftVariants((prev) => ({ ...prev, [giftItem.giftProductId]: variants }));
    }

    if (variants.length > 0) {
      setGiftModal({ itemKey, giftSetId, giftItem, freeCount });
    } else {
      // 옵션 없음 → 바로 추가 또는 수량 증가
      const existing = current.find((s) => s.giftProductId === giftItem.giftProductId && !s.variantId);
      if (existing) {
        setGiftSels((prev) => ({
          ...prev,
          [key]: current.map((s) => s === existing ? { ...s, quantity: s.quantity + 1 } : s),
        }));
      } else {
        setGiftSels((prev) => ({
          ...prev,
          [key]: [...current, { giftProductId: giftItem.giftProductId, giftProductName: giftItem.giftProductName, variantId: null, optionText: '', quantity: 1 }],
        }));
      }
    }
  }

  function handleGiftVariantSelect(v: VariantResult) {
    if (!giftModal) return;
    const { itemKey, giftSetId, giftItem, freeCount } = giftModal;
    const key     = giftSelKey(itemKey, giftSetId);
    const current = giftSels[key] ?? [];
    if (selTotal(current) >= freeCount) { setGiftModal(null); return; }
    const existing = current.find((s) => s.variantId === v.id);
    if (existing) {
      setGiftSels((prev) => ({ ...prev, [key]: current.map((s) => s === existing ? { ...s, quantity: s.quantity + 1 } : s) }));
    } else {
      setGiftSels((prev) => ({
        ...prev,
        [key]: [...current, { giftProductId: giftItem.giftProductId, giftProductName: giftItem.giftProductName, variantId: v.id, optionText: v.optionText, quantity: 1 }],
      }));
    }
    setGiftModal(null);
  }

  function removeGiftSel(itemKey: string, giftSetId: string, selIdx: number) {
    const key = giftSelKey(itemKey, giftSetId);
    setGiftSels((prev) => ({ ...prev, [key]: (prev[key] ?? []).filter((_, i) => i !== selIdx) }));
  }

  // 아이템별 auto 사은품 계산 (렌더링용)
  function getAutoGifts(item: EditItem) {
    const sets = productGiftSets[item.productId] ?? [];
    return resolveAutoGifts(sets, item.productId, item.quantity);
  }

  // ── 우편번호 검색 ─────────────────────────────────────────────────────────
  function handlePostcodeSearch() {
    openDaumPostcode((data) => {
      setPostalCode(data.zonecode);
      setAddress1(data.roadAddress || data.address);
      setAddress2('');
    });
  }

  // ── 저장 ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!user) return;
    if (!ordererName || !ordererPhone) { alert('주문자 정보를 입력해주세요.'); return; }
    if (items.length === 0) { alert('구매 상품을 1개 이상 추가해주세요.'); return; }

    let rName: string, rPhone: string, rPostalCode: string, rAddress1: string, rAddress2: string | undefined;
    const savedSel = savedAddresses.find((a) => a.id === selAddrId);
    if (savedSel) {
      rName = savedSel.recipientName; rPhone = savedSel.recipientPhone;
      rPostalCode = savedSel.postalCode; rAddress1 = savedSel.address1; rAddress2 = savedSel.address2 ?? undefined;
    } else {
      rName      = sameAsOrderer ? ordererName  : recipientName;
      rPhone     = sameAsOrderer ? ordererPhone : recipientPhone;
      rPostalCode = postalCode; rAddress1 = address1; rAddress2 = address2 || undefined;
    }
    if (!rName || !rPhone || !rPostalCode || !rAddress1) { alert('배송지 정보를 입력해주세요.'); return; }

    // 전체 아이템 합산
    type OrderItem = { productId: string; variantId?: string | null; productName: string; optionText?: string; quantity: number; unitPrice: number; itemType: string };
    const allItems: OrderItem[] = items.map((i) => ({
      productId: i.productId, variantId: i.variantId, productName: i.productName,
      optionText: i.optionText || undefined, quantity: i.quantity, unitPrice: i.unitPrice, itemType: 'purchase',
    }));

    // 수동 사은품 선택
    Object.values(giftSels).flat().forEach((sel) => {
      allItems.push({ productId: sel.giftProductId, variantId: sel.variantId, productName: sel.giftProductName, optionText: sel.optionText || undefined, quantity: sel.quantity, unitPrice: 0, itemType: 'gift' });
    });

    // auto 사은품
    items.forEach((item) => {
      getAutoGifts(item).forEach((ag) => {
        allItems.push({
          productId: ag.giftType === 'auto_same' ? item.productId : ag.giftProductId,
          variantId: ag.giftType === 'auto_same' ? item.variantId : null,
          productName: ag.giftType === 'auto_same' ? item.productName : ag.giftProductName,
          optionText: ag.giftType === 'auto_same' ? item.optionText || undefined : undefined,
          quantity: ag.quantity, unitPrice: 0, itemType: 'gift',
        });
      });
    });

    setSaving(true);
    try {
      const order = await createAdminOrder({
        userId: foundUser?.id ?? null, ordererName, ordererPhone,
        recipientName: rName, recipientPhone: rPhone,
        postalCode: rPostalCode, address1: rAddress1, address2: rAddress2,
        shippingMessage: shippingMessage || undefined,
        items: allItems, paymentMethod,
        discountAmount: discountAmount || undefined,
        shippingFeeOverride: shippingFeeManual ? shippingFeeOverride : null,
        adminMemo: adminMemo || undefined, initialStatus,
      }, user.id);
      navigate(`/admin/orders/${order.id}`);
    } catch (err: any) {
      alert(err.message ?? '주문 생성 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  // ════════════════════════════════════════════════════════════════════════
  // JSX
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="container py-8">
      <Link to="/admin/orders" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />주문 목록
      </Link>
      <h1 className="text-2xl font-bold mb-6">새 주문 생성</h1>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-0 mb-8">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className={`flex items-center gap-2 ${i <= step ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2
                ${i < step ? 'bg-blue-600 border-blue-600 text-white' : i === step ? 'border-blue-600 text-blue-600' : 'border-gray-300 text-gray-400'}`}>
                {i + 1}
              </div>
              <span className="text-sm font-medium hidden sm:block">{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ═══ Step 0: 고객 정보 ════════════════════════════════════════════ */}
      {step === 0 && (
        <Card className="p-6 space-y-5">
          <h2 className="flex items-center gap-2 font-semibold text-gray-800">
            <User className="h-4 w-4" />고객 정보
          </h2>

          {/* 회원 검색 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">회원 검색 (선택)</label>
            {foundUser ? (
              <div className="flex items-center justify-between rounded-lg border bg-blue-50 px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-blue-900">{foundUser.name}</p>
                  <p className="text-xs text-blue-600">{foundUser.email} · {foundUser.phone}</p>
                </div>
                <button onClick={clearUser} className="text-xs text-red-500 hover:text-red-700">해제</button>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <Input
                    value={userSearchQ}
                    onChange={(e) => setUserSearchQ(e.target.value)}
                    placeholder="이름 · 이메일 · 전화번호 검색..."
                    onKeyDown={(e) => e.key === 'Enter' && handleUserSearch()}
                  />
                  <Button variant="outline" onClick={handleUserSearch} size="sm"><Search className="h-4 w-4" /></Button>
                </div>
                {userSearchResults.length > 0 && (
                  <div className="mt-2 border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {userSearchResults.map((u) => (
                      <button key={u.id} onClick={() => selectUser(u)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left text-sm">
                        <div>
                          <p className="font-medium">{u.name || '(이름 없음)'}</p>
                          <p className="text-xs text-gray-500">{u.email} · {u.phone}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {userSearchResults.length === 0 && userSearchQ && (
                  <p className="mt-2 text-xs text-gray-400">비회원 주문으로 아래 정보를 직접 입력하세요.</p>
                )}
              </div>
            )}
          </div>

          {/* 주문자 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">주문자명 <span className="text-red-500">*</span></label>
              <Input value={ordererName} onChange={(e) => setOrdererName(e.target.value)} placeholder="홍길동" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">연락처 <span className="text-red-500">*</span></label>
              <Input value={ordererPhone} onChange={(e) => setOrdererPhone(e.target.value)} placeholder="010-0000-0000" />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setStep(1)} disabled={!ordererName || !ordererPhone}>다음 →</Button>
          </div>
        </Card>
      )}

      {/* ═══ Step 1: 상품 선택 ════════════════════════════════════════════ */}
      {step === 1 && (
        <Card className="p-6 space-y-5">
          <h2 className="flex items-center gap-2 font-semibold text-gray-800">
            <Package className="h-4 w-4" />상품 선택
          </h2>

          {/* 추가된 아이템 목록 */}
          <div className="space-y-3">
            {items.map((item) => {
              const sets       = productGiftSets[item.productId] ?? [];
              const selectSets = sets.filter((s) => s.giftType === 'select');
              const autoGifts  = resolveAutoGifts(sets, item.productId, item.quantity);

              return (
                <div key={item.key} className="rounded-lg border overflow-hidden">
                  {/* 구매 상품 행 */}
                  <div className="flex items-center gap-2 p-3 text-sm bg-white">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{item.productName}</p>
                        {item.optionText && <span className="text-xs text-gray-500">({item.optionText})</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">단가</span>
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updatePrice(item.key, Number(e.target.value))}
                          className="w-24 rounded border px-2 py-0.5 text-xs"
                        />
                        <span className="text-xs text-gray-400">원</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => updateQty(item.key, -1)} className="h-7 w-7 flex items-center justify-center rounded border hover:bg-gray-100"><Minus className="h-3 w-3" /></button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <button onClick={() => updateQty(item.key, 1)} className="h-7 w-7 flex items-center justify-center rounded border hover:bg-gray-100"><Plus className="h-3 w-3" /></button>
                    </div>
                    <div className="shrink-0 font-medium w-24 text-right">{(item.unitPrice * item.quantity).toLocaleString()}원</div>
                    <button onClick={() => removeItem(item.key)} className="shrink-0 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>

                  {/* auto 사은품 표시 */}
                  {autoGifts.length > 0 && (
                    <div className="px-3 py-2 bg-green-50 border-t text-xs space-y-1">
                      <p className="font-medium text-green-700 flex items-center gap-1"><Gift className="h-3 w-3" />자동 증정</p>
                      {autoGifts.map((ag, i) => (
                        <p key={i} className="text-green-600 pl-4">
                          {ag.giftSetName}: {ag.giftType === 'auto_same' ? `${item.productName}${item.optionText ? ` (${item.optionText})` : ''}` : ag.giftProductName} × {ag.quantity}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* select 타입 사은품 세트 */}
                  {selectSets.map((set) => {
                    const sels      = getSels(item.key, set.id);
                    const total     = selTotal(sels);
                    const freeCount = getApplicableFreeCount(set.tiers, item.quantity);
                    if (freeCount === 0) return null;

                    return (
                      <div key={set.id} className="px-3 py-2 bg-blue-50 border-t text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-blue-700 flex items-center gap-1">
                            <Gift className="h-3 w-3" />{set.name}
                          </p>
                          <span className={`${total >= freeCount ? 'text-blue-700 font-bold' : 'text-gray-500'}`}>
                            {total} / {freeCount} 선택
                          </span>
                        </div>

                        {/* 선택된 사은품 */}
                        {sels.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pl-4">
                            {sels.map((sel, si) => (
                              <span key={si} className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5">
                                {sel.giftProductName}{sel.optionText ? ` (${sel.optionText})` : ''} × {sel.quantity}
                                <button onClick={() => removeGiftSel(item.key, set.id, si)} className="text-blue-400 hover:text-blue-700 ml-0.5">
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* 사은품 목록 */}
                        {total < freeCount && (
                          <div className="flex flex-wrap gap-1.5 pl-4">
                            {set.items.map((gi) => (
                              <button
                                key={gi.id}
                                onClick={() => handleGiftItemClick(item.key, set.id, gi, freeCount)}
                                className="rounded border border-blue-300 bg-white px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-40"
                                disabled={gi.giftProductStock === 0}
                              >
                                {gi.giftProductName}
                                {gi.giftProductStock === 0 && <span className="ml-1 text-gray-400">(품절)</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {items.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">상품을 검색하여 추가해주세요.</p>
            )}
          </div>

          {/* 소계 */}
          {items.length > 0 && (
            <div className="text-right text-sm text-gray-600">
              구매 소계 <span className="font-bold text-gray-900">{purchaseSubtotal.toLocaleString()}원</span>
            </div>
          )}

          {/* 카테고리 + 상품 검색 */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-medium text-gray-600">상품 추가</p>

            {/* 카테고리 드롭다운 */}
            <div className="flex gap-2">
              <Select
                value={selParentCatId || '__all__'}
                onValueChange={(v) => { setSelParentCatId(v === '__all__' ? '' : v); setSelCatId(''); }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="대카테고리" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">전체 카테고리</SelectItem>
                  {parentCats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {childCats.length > 0 && (
                <Select value={selCatId || '__all__'} onValueChange={(v) => setSelCatId(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="소카테고리" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">전체</SelectItem>
                    {childCats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 상품 검색 */}
            <div className="flex gap-2">
              <Input
                value={productQ}
                onChange={(e) => setProductQ(e.target.value)}
                placeholder="상품명 검색... (비워두면 카테고리 전체 조회)"
                onKeyDown={(e) => e.key === 'Enter' && handleProductSearch()}
              />
              <Button variant="outline" onClick={handleProductSearch}><Search className="h-4 w-4" /></Button>
            </div>

            {/* 상품 결과 */}
            {productResults.length > 0 && !selProduct && (
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {productResults.map((p) => (
                  <button key={p.id} onClick={() => handleProductSelect(p)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 text-sm text-left">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-gray-500">{p.price.toLocaleString()}원</span>
                  </button>
                ))}
              </div>
            )}

            {/* 옵션 선택 */}
            {selProduct && variantResults.length > 0 && (
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-500 bg-gray-50">
                  <span>옵션 선택 — {selProduct.name}</span>
                  <button onClick={() => { setSelProduct(null); setVariantResults([]); }} className="text-red-400 hover:text-red-600">
                    <X className="h-3 w-3" />
                  </button>
                </div>
                {variantResults.map((v) => (
                  <button key={v.id} onClick={() => handleVariantSelect(v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 text-sm text-left">
                    <span>{v.optionText}</span>
                    <span className="text-gray-500">{v.price.toLocaleString()}원</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>← 이전</Button>
            <Button onClick={() => setStep(2)} disabled={items.length === 0}>다음 →</Button>
          </div>
        </Card>
      )}

      {/* ═══ Step 2: 배송 · 결제 ══════════════════════════════════════════ */}
      {step === 2 && (
        <div className="space-y-5">
          {/* 배송지 */}
          <Card className="p-6 space-y-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-800"><MapPin className="h-4 w-4" />배송지</h2>

            {savedAddresses.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">저장된 배송지</label>
                <div className="space-y-2">
                  {savedAddresses.map((addr) => (
                    <label key={addr.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${selAddrId === addr.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <input type="radio" name="savedAddress" value={addr.id}
                        checked={selAddrId === addr.id} onChange={() => handleSavedAddrSelect(addr.id)} className="mt-0.5" />
                      <div className="text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{addr.name}</span>
                          {addr.isDefault && <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">기본</span>}
                        </div>
                        <p className="text-gray-600 mt-0.5">{addr.recipientName} · {addr.recipientPhone}</p>
                        <p className="text-gray-500 text-xs mt-0.5">[{addr.postalCode}] {addr.address1} {addr.address2}</p>
                      </div>
                    </label>
                  ))}
                  <label className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${selAddrId === 'new' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <input type="radio" name="savedAddress" value="new" checked={selAddrId === 'new'} onChange={() => handleSavedAddrSelect('new')} />
                    <span className="text-sm font-medium text-gray-700">+ 새 배송지 직접 입력</span>
                  </label>
                </div>
              </div>
            )}

            {(savedAddresses.length === 0 || selAddrId === 'new') && (
              <>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={sameAsOrderer} onChange={(e) => setSameAsOrderer(e.target.checked)} className="rounded" />
                  주문자 정보와 동일 <span className="text-gray-400">({ordererName} / {ordererPhone})</span>
                </label>

                {!sameAsOrderer && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">수령인 <span className="text-red-500">*</span></label>
                      <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">연락처 <span className="text-red-500">*</span></label>
                      <Input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} />
                    </div>
                  </div>
                )}

                {/* 우편번호 (다음 검색) */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">우편번호 <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="12345" className="w-32" readOnly />
                    <Button type="button" variant="outline" size="sm" onClick={handlePostcodeSearch}>
                      <Search className="h-3.5 w-3.5 mr-1" />우편번호 검색
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">주소 <span className="text-red-500">*</span></label>
                  <Input value={address1} onChange={(e) => setAddress1(e.target.value)} placeholder="도로명 주소" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">상세주소</label>
                  <Input value={address2} onChange={(e) => setAddress2(e.target.value)} placeholder="동/호수 등" />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">배송 메시지</label>
              <Input value={shippingMessage} onChange={(e) => setShippingMessage(e.target.value)} placeholder="문 앞에 놓아주세요" />
            </div>
          </Card>

          {/* 결제 */}
          <Card className="p-6 space-y-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-800"><CreditCard className="h-4 w-4" />결제</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">결제 방법</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">무통장입금</SelectItem>
                    <SelectItem value="cash">현금 직접 결제</SelectItem>
                    <SelectItem value="card">카드</SelectItem>
                    <SelectItem value="other">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">주문 상태</label>
                <Select value={initialStatus} onValueChange={(v) => setInitialStatus(v as 'pending' | 'paid')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">입금대기 (pending)</SelectItem>
                    <SelectItem value="paid">결제완료 (paid)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">임의 할인</label>
                <Input type="number" value={discountAmount || ''} onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)} placeholder="0" />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1 cursor-pointer">
                  <input type="checkbox" checked={shippingFeeManual} onChange={(e) => setShippingFeeManual(e.target.checked)} />
                  배송비 직접 입력
                </label>
                <Input
                  type="number"
                  value={shippingFeeManual ? (shippingFeeOverride || '') : calcShippingFee}
                  onChange={(e) => setShippingFeeOverride(Number(e.target.value) || 0)}
                  disabled={!shippingFeeManual}
                  placeholder={String(calcShippingFee)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">관리자 메모</label>
              <textarea
                value={adminMemo} onChange={(e) => setAdminMemo(e.target.value)} rows={2}
                placeholder="내부 메모 (고객에게 노출되지 않음)"
                className="w-full rounded-md border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </Card>

          {/* 최종 금액 */}
          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-gray-800">최종 금액</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">상품 소계</dt><dd>{purchaseSubtotal.toLocaleString()}원</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">배송비</dt>
                <dd>{calcShippingFee === 0 ? '무료' : `+${calcShippingFee.toLocaleString()}원`}</dd>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <dt>임의 할인</dt><dd>-{discountAmount.toLocaleString()}원</dd>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 font-bold text-base">
                <dt>최종 결제금액</dt><dd className="text-blue-600">{totalAmount.toLocaleString()}원</dd>
              </div>
            </dl>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>← 이전</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? '생성 중...' : '주문 생성'}</Button>
          </div>
        </div>
      )}

      {/* ═══ 사은품 옵션 선택 모달 ════════════════════════════════════════ */}
      {giftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                사은품 옵션 선택
              </h3>
              <button onClick={() => setGiftModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              {giftModal.giftItem.giftProductName} — 옵션을 선택하세요
            </p>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {(giftVariants[giftModal.giftItem.giftProductId] ?? []).map((v) => (
                <button key={v.id} onClick={() => handleGiftVariantSelect(v)}
                  className="w-full text-left px-3 py-2.5 rounded-lg border hover:bg-blue-50 hover:border-blue-300 text-sm transition-colors"
                  disabled={v.stock === 0}>
                  <span>{v.optionText}</span>
                  {v.stock === 0 && <span className="ml-2 text-xs text-gray-400">(품절)</span>}
                </button>
              ))}
            </div>
            <div className="mt-4 text-xs text-gray-400 text-right">
              현재 {selTotal(getSels(giftModal.itemKey, giftModal.giftSetId))} / {giftModal.freeCount} 선택됨
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
