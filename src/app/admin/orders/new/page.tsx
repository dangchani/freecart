import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Search, Plus, Minus, Trash2, User, Package, CreditCard, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createAdminOrder } from '@/services/orders';
import { getUserAddresses, type UserAddress } from '@/services/addresses';

interface FoundUser {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface ProductResult {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface VariantResult {
  id: string;
  optionText: string;
  price: number;
  additionalPrice: number;
  stock: number;
}

interface EditItem {
  productId: string;
  variantId: string | null;
  productName: string;
  optionText: string;
  unitPrice: number;
  quantity: number;
  itemType: 'purchase' | 'gift';
}

const STEP_LABELS = ['고객 정보', '상품 선택', '배송 · 결제'];

export default function AdminNewOrderPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // ─── Step 0: 고객 ───────────────────────────────────────────────
  const [userSearchQ, setUserSearchQ]     = useState('');
  const [foundUser, setFoundUser]         = useState<FoundUser | null>(null);
  const [userSearchResults, setUserSearchResults] = useState<FoundUser[]>([]);
  const [ordererName, setOrdererName]     = useState('');
  const [ordererPhone, setOrdererPhone]   = useState('');

  // ─── Step 1: 상품 ───────────────────────────────────────────────
  const [items, setItems]                 = useState<EditItem[]>([]);
  const [productQ, setProductQ]           = useState('');
  const [productResults, setProductResults] = useState<ProductResult[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductResult | null>(null);
  const [variantResults, setVariantResults]   = useState<VariantResult[]>([]);

  // ─── Step 2: 배송 · 결제 ─────────────────────────────────────────
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | 'new'>('new');
  const [sameAsOrderer, setSameAsOrderer] = useState(true);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [postalCode, setPostalCode]       = useState('');
  const [address1, setAddress1]           = useState('');
  const [address2, setAddress2]           = useState('');
  const [shippingMessage, setShippingMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [shippingFeeManual, setShippingFeeManual] = useState(false);
  const [shippingFeeOverride, setShippingFeeOverride] = useState(0);
  const [adminMemo, setAdminMemo]         = useState('');
  const [initialStatus, setInitialStatus] = useState<'pending' | 'paid'>('pending');

  // ─── 배송비 설정 캐시 ──────────────────────────────────────────
  const [baseFee, setBaseFee]             = useState(3000);
  const [freeThreshold, setFreeThreshold] = useState(50000);

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

  // ── 금액 계산 ─────────────────────────────────────────────────
  const purchaseSubtotal = items
    .filter((i) => i.itemType === 'purchase')
    .reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const calcShippingFee = shippingFeeManual
    ? shippingFeeOverride
    : purchaseSubtotal >= freeThreshold ? 0 : baseFee;

  const totalAmount = Math.max(0, purchaseSubtotal + calcShippingFee - discountAmount);

  // ── 회원 검색 ─────────────────────────────────────────────────
  async function handleUserSearch() {
    if (!userSearchQ.trim()) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('users')
      .select('id, name, email, phone')
      .or(`email.ilike.%${userSearchQ.trim()}%,phone.ilike.%${userSearchQ.trim()}%,name.ilike.%${userSearchQ.trim()}%`)
      .limit(8);
    setUserSearchResults((data ?? []).map((u: any) => ({
      id: u.id, name: u.name ?? '', email: u.email ?? '', phone: u.phone ?? '',
    })));
  }

  async function selectUser(u: FoundUser) {
    setFoundUser(u);
    setOrdererName(u.name);
    setOrdererPhone(u.phone);
    setUserSearchResults([]);
    setUserSearchQ('');
    // 저장된 배송지 로드
    try {
      const addrs = await getUserAddresses(u.id);
      setSavedAddresses(addrs);
      if (addrs.length > 0) {
        const def = addrs.find((a) => a.isDefault) ?? addrs[0];
        setSelectedAddressId(def.id);
        applyAddress(def);
      } else {
        setSelectedAddressId('new');
      }
    } catch {
      setSavedAddresses([]);
      setSelectedAddressId('new');
    }
  }

  function applyAddress(addr: UserAddress) {
    setSameAsOrderer(false);
    setRecipientName(addr.recipientName);
    setRecipientPhone(addr.recipientPhone);
    setPostalCode(addr.postalCode);
    setAddress1(addr.address1);
    setAddress2(addr.address2 ?? '');
  }

  function handleSavedAddressSelect(id: string) {
    setSelectedAddressId(id);
    if (id === 'new') {
      setRecipientName('');
      setRecipientPhone('');
      setPostalCode('');
      setAddress1('');
      setAddress2('');
      setSameAsOrderer(true);
    } else {
      const addr = savedAddresses.find((a) => a.id === id);
      if (addr) applyAddress(addr);
    }
  }

  function clearUser() {
    setFoundUser(null);
    setOrdererName('');
    setOrdererPhone('');
    setSavedAddresses([]);
    setSelectedAddressId('new');
  }

  // ── 상품 검색 ─────────────────────────────────────────────────
  async function handleProductSearch() {
    if (!productQ.trim()) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('products')
      .select('id, name, sale_price, stock_quantity')
      .ilike('name', `%${productQ.trim()}%`)
      .eq('status', 'active')
      .limit(10);
    setProductResults((data ?? []).map((p: any) => ({
      id: p.id, name: p.name, price: p.sale_price, stock: p.stock_quantity ?? 0,
    })));
    setSelectedProduct(null);
    setVariantResults([]);
  }

  async function selectProduct(p: ProductResult) {
    setSelectedProduct(p);
    const supabase = createClient();

    const [{ data: variants }, { data: optRows }, { data: valRows }] = await Promise.all([
      supabase
        .from('product_variants')
        .select('id, option_values, additional_price, stock_quantity')
        .eq('product_id', p.id)
        .eq('is_active', true),
      supabase
        .from('product_options')
        .select('id, name')
        .eq('product_id', p.id),
      supabase
        .from('product_option_values')
        .select('id, option_id, value'),
    ]);

    if (!variants || variants.length === 0) {
      addItem({ productId: p.id, variantId: null, productName: p.name, optionText: '', unitPrice: p.price, quantity: 1, itemType: 'purchase' });
      setSelectedProduct(null);
      setProductResults([]);
      setProductQ('');
    } else {
      // option_values: [{ optionId, valueId }, ...]  →  "색상: 빨강 / 사이즈: M"
      const optMap = new Map((optRows ?? []).map((o: any) => [o.id, o.name]));
      const valMap = new Map((valRows ?? []).map((v: any) => [v.id, { optionId: v.option_id, value: v.value }]));

      setVariantResults(variants.map((v: any) => {
        const raw: { optionId: string; valueId: string }[] = v.option_values ?? [];
        const parts = raw.map((ov) => {
          const optName = optMap.get(ov.optionId) ?? '';
          const val     = valMap.get(ov.valueId);
          return val ? `${optName}: ${val.value}` : '';
        }).filter(Boolean);
        return {
          id:              v.id,
          optionText:      parts.join(' / ') || v.id,
          price:           p.price + (v.additional_price ?? 0),
          additionalPrice: v.additional_price ?? 0,
          stock:           v.stock_quantity ?? 0,
        };
      }));
    }
  }

  function selectVariant(v: VariantResult) {
    if (!selectedProduct) return;
    addItem({
      productId:   selectedProduct.id,
      variantId:   v.id,
      productName: selectedProduct.name,
      optionText:  v.optionText,
      unitPrice:   v.price,
      quantity:    1,
      itemType:    'purchase',
    });
    setSelectedProduct(null);
    setVariantResults([]);
    setProductResults([]);
    setProductQ('');
  }

  function addItem(item: EditItem) {
    setItems((prev) => [...prev, item]);
  }

  function updateQty(idx: number, delta: number) {
    setItems((prev) => prev.map((i, j) => j === idx ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  }

  function updatePrice(idx: number, price: number) {
    setItems((prev) => prev.map((i, j) => j === idx ? { ...i, unitPrice: price } : i));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, j) => j !== idx));
  }

  // ── 저장 ──────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!user) return;
    if (!ordererName || !ordererPhone) { alert('주문자 정보를 입력해주세요.'); return; }
    if (items.filter((i) => i.itemType === 'purchase').length === 0) { alert('구매 상품을 1개 이상 추가해주세요.'); return; }

    // 저장된 배송지 선택 시 해당 주소 사용
    let rName: string, rPhone: string, rPostalCode: string, rAddress1: string, rAddress2: string | undefined;
    const selectedSaved = savedAddresses.find((a) => a.id === selectedAddressId);
    if (selectedSaved) {
      rName = selectedSaved.recipientName;
      rPhone = selectedSaved.recipientPhone;
      rPostalCode = selectedSaved.postalCode;
      rAddress1 = selectedSaved.address1;
      rAddress2 = selectedSaved.address2 ?? undefined;
    } else {
      rName  = sameAsOrderer ? ordererName  : recipientName;
      rPhone = sameAsOrderer ? ordererPhone : recipientPhone;
      rPostalCode = postalCode;
      rAddress1 = address1;
      rAddress2 = address2 || undefined;
    }
    if (!rName || !rPhone || !rPostalCode || !rAddress1) { alert('배송지 정보를 입력해주세요.'); return; }

    setSaving(true);
    try {
      const order = await createAdminOrder({
        userId:            foundUser?.id ?? null,
        ordererName,
        ordererPhone,
        recipientName:     rName,
        recipientPhone:    rPhone,
        postalCode:        rPostalCode,
        address1:          rAddress1,
        address2:          rAddress2,
        shippingMessage:   shippingMessage || undefined,
        items,
        paymentMethod,
        discountAmount:    discountAmount || undefined,
        shippingFeeOverride: shippingFeeManual ? shippingFeeOverride : null,
        adminMemo:         adminMemo || undefined,
        initialStatus,
      }, user.id);

      navigate(`/admin/orders/${order.id}`);
    } catch (err: any) {
      alert(err.message ?? '주문 생성 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

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

      {/* ─── Step 0: 고객 정보 ─────────────────────────────────── */}
      {step === 0 && (
        <Card className="p-6 space-y-5">
          <h2 className="flex items-center gap-2 font-semibold text-gray-800"><User className="h-4 w-4" />고객 정보</h2>

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

          {/* 주문자 정보 */}
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

      {/* ─── Step 1: 상품 선택 ─────────────────────────────────── */}
      {step === 1 && (
        <Card className="p-6 space-y-5">
          <h2 className="flex items-center gap-2 font-semibold text-gray-800"><Package className="h-4 w-4" />상품 선택</h2>

          {/* 현재 아이템 목록 */}
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{item.productName}</p>
                    {item.optionText && <span className="text-xs text-gray-500">({item.optionText})</span>}
                    {item.itemType === 'gift' && <span className="text-xs bg-blue-100 text-blue-700 rounded px-1">사은품</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">단가</span>
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updatePrice(idx, Number(e.target.value))}
                      className="w-24 rounded border px-2 py-0.5 text-xs"
                    />
                    <span className="text-xs text-gray-400">원</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => updateQty(idx, -1)} className="h-7 w-7 flex items-center justify-center rounded border hover:bg-gray-100"><Minus className="h-3 w-3" /></button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <button onClick={() => updateQty(idx, 1)} className="h-7 w-7 flex items-center justify-center rounded border hover:bg-gray-100"><Plus className="h-3 w-3" /></button>
                </div>
                <div className="shrink-0 font-medium w-24 text-right">{(item.unitPrice * item.quantity).toLocaleString()}원</div>
                <button onClick={() => removeItem(idx)} className="shrink-0 text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-gray-400 text-center py-6">상품을 검색하여 추가해주세요.</p>}
          </div>

          {/* 소계 */}
          {items.length > 0 && (
            <div className="text-right text-sm text-gray-600">
              구매 소계 <span className="font-bold text-gray-900">{purchaseSubtotal.toLocaleString()}원</span>
            </div>
          )}

          {/* 상품 검색 */}
          <div className="border-t pt-4">
            <div className="flex gap-2">
              <Input
                value={productQ}
                onChange={(e) => setProductQ(e.target.value)}
                placeholder="상품명 검색..."
                onKeyDown={(e) => e.key === 'Enter' && handleProductSearch()}
              />
              <Button variant="outline" onClick={handleProductSearch}><Search className="h-4 w-4" /></Button>
            </div>

            {productResults.length > 0 && !selectedProduct && (
              <div className="mt-2 border rounded-lg divide-y max-h-48 overflow-y-auto">
                {productResults.map((p) => (
                  <button key={p.id} onClick={() => selectProduct(p)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 text-sm text-left">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-gray-500">{p.price.toLocaleString()}원</span>
                  </button>
                ))}
              </div>
            )}

            {selectedProduct && variantResults.length > 0 && (
              <div className="mt-2 border rounded-lg divide-y max-h-48 overflow-y-auto">
                <p className="px-3 py-2 text-xs text-gray-500 bg-gray-50">옵션 선택 — {selectedProduct.name}</p>
                {variantResults.map((v) => (
                  <button key={v.id} onClick={() => selectVariant(v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 text-sm text-left">
                    <span>{v.optionText}</span>
                    <span className="text-gray-500">{(v.price || selectedProduct.price + v.additionalPrice).toLocaleString()}원</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 사은품 추가 버튼 */}
          <button
            onClick={() => {
              const name = prompt('사은품 상품명을 입력하세요');
              if (!name) return;
              const pid = prompt('상품 ID (없으면 비워두세요)') ?? '';
              setItems((prev) => [...prev, { productId: pid || 'gift-' + Date.now(), variantId: null, productName: name, optionText: '', unitPrice: 0, quantity: 1, itemType: 'gift' }]);
            }}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <Plus className="h-3 w-3" />사은품 추가 (재고 차감 없음)
          </button>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>← 이전</Button>
            <Button onClick={() => setStep(2)} disabled={items.filter((i) => i.itemType === 'purchase').length === 0}>다음 →</Button>
          </div>
        </Card>
      )}

      {/* ─── Step 2: 배송 · 결제 ──────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          {/* 배송지 */}
          <Card className="p-6 space-y-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-800"><MapPin className="h-4 w-4" />배송지</h2>

            {/* 저장된 배송지 선택 (회원 선택 시에만) */}
            {savedAddresses.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">저장된 배송지</label>
                <div className="space-y-2">
                  {savedAddresses.map((addr) => (
                    <label key={addr.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${selectedAddressId === addr.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <input
                        type="radio"
                        name="savedAddress"
                        value={addr.id}
                        checked={selectedAddressId === addr.id}
                        onChange={() => handleSavedAddressSelect(addr.id)}
                        className="mt-0.5"
                      />
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
                  <label
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${selectedAddressId === 'new' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="savedAddress"
                      value="new"
                      checked={selectedAddressId === 'new'}
                      onChange={() => handleSavedAddressSelect('new')}
                    />
                    <span className="text-sm font-medium text-gray-700">+ 새 배송지 직접 입력</span>
                  </label>
                </div>
              </div>
            )}

            {/* 주문자와 동일 체크박스 (저장 배송지 없거나 새 배송지 선택 시) */}
            {(savedAddresses.length === 0 || selectedAddressId === 'new') && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={sameAsOrderer} onChange={(e) => setSameAsOrderer(e.target.checked)} className="rounded" />
                주문자 정보와 동일 <span className="text-gray-400">({ordererName} / {ordererPhone})</span>
              </label>
            )}

            {/* 수령인 필드 (직접 입력 시 or 주문자와 다를 때) */}
            {(savedAddresses.length === 0 || selectedAddressId === 'new') && !sameAsOrderer && (
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

            {/* 주소 필드 (저장 배송지 선택 시 읽기전용, 새 입력 시 편집 가능) */}
            {(savedAddresses.length === 0 || selectedAddressId === 'new') && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">우편번호 <span className="text-red-500">*</span></label>
                  <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="12345" />
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
                <Input
                  type="number"
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                  placeholder="0"
                />
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
                value={adminMemo}
                onChange={(e) => setAdminMemo(e.target.value)}
                rows={2}
                placeholder="내부 메모 (고객에게 노출되지 않음)"
                className="w-full rounded-md border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </Card>

          {/* 최종 금액 요약 */}
          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-gray-800">최종 금액</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">상품 소계</dt>
                <dd>{purchaseSubtotal.toLocaleString()}원</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">배송비</dt>
                <dd>{calcShippingFee === 0 ? '무료' : `+${calcShippingFee.toLocaleString()}원`}</dd>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <dt>임의 할인</dt>
                  <dd>-{discountAmount.toLocaleString()}원</dd>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 font-bold text-base">
                <dt>최종 결제금액</dt>
                <dd className="text-blue-600">{totalAmount.toLocaleString()}원</dd>
              </div>
            </dl>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>← 이전</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? '생성 중...' : '주문 생성'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
