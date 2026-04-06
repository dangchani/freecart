import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import { getCart } from '@/services/cart';
import { createOrder } from '@/services/orders';
import { getUserCoupons, calculateCouponDiscount, registerCouponByCode, useCoupon, type UserCoupon } from '@/services/coupons';
import { getUserPoints, validatePointsUsage, usePoints } from '@/services/points';
import { getUserAddresses, type UserAddress } from '@/services/addresses';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { getShippingSettings, getPointSettings, getBankTransferSettings } from '@/services/settings';
import type { CartItem } from '@/types';
import { Ticket, Coins, Check, X, ChevronDown, ChevronUp, MapPin } from 'lucide-react';

interface ActivePG {
  provider: string;
  name: string;
  clientKey: string;
}

interface BankTransferSettings {
  enabled: boolean;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  depositDeadlineHours: number;
}

type PaymentMethod = 'pg' | 'bank_transfer';

const checkoutSchema = z.object({
  recipientName: z.string().min(1, '수령인 이름을 입력해주세요'),
  recipientPhone: z.string().min(10, '휴대폰 번호를 입력해주세요'),
  address: z.string().min(1, '주소를 입력해주세요'),
  postalCode: z.string().min(5, '우편번호를 입력해주세요'),
  deliveryRequest: z.string().optional(),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

async function loadActivePG(): Promise<ActivePG | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('payment_gateways')
      .select('provider, name, client_key')
      .eq('is_active', true)
      .maybeSingle();

    if (!data) return null;
    return { provider: data.provider, name: data.name, clientKey: data.client_key || '' };
  } catch {
    return null;
  }
}

async function requestPayment(
  pg: ActivePG,
  params: {
    amount: number;
    orderId: string;
    orderName: string;
    customerName: string;
    customerPhone: string;
    successUrl: string;
    failUrl: string;
  }
) {
  switch (pg.provider) {
    case 'toss': {
      const { loadTossPayments } = await import('@tosspayments/payment-sdk');
      const toss = await loadTossPayments(pg.clientKey);
      await toss.requestPayment('카드', {
        amount: params.amount,
        orderId: params.orderId,
        orderName: params.orderName,
        customerName: params.customerName,
        customerMobilePhone: params.customerPhone,
        successUrl: params.successUrl,
        failUrl: params.failUrl,
      });
      break;
    }

    case 'inicis': {
      // KG이니시스 - script 방식 (INIpay)
      await loadScript('https://stdpay.inicis.com/stdjs/INIStdPay.js');
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://stdpay.inicis.com/stdjs/INIStdPay.js';

      const fields: Record<string, string> = {
        P_INI_PAYMENT: 'CARD',
        P_MID: pg.clientKey,
        P_OID: params.orderId,
        P_AMT: params.amount.toString(),
        P_GOODS: params.orderName,
        P_UNAME: params.customerName,
        P_MOBILE: params.customerPhone,
        P_NEXT_URL: params.successUrl,
        P_RETURN_URL: params.failUrl,
      };

      Object.entries(fields).forEach(([key, val]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = val;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
      break;
    }

    case 'kiwoom':
    case 'kcp':
    case 'nicepay': {
      throw new Error(`${pg.name}은 현재 준비 중입니다. 다른 결제 수단을 선택해주세요.`);
    }

    default:
      throw new Error(`지원하지 않는 PG사입니다: ${pg.provider}`);
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Script load failed: ${src}`));
    document.head.appendChild(script);
  });
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activePG, setActivePG] = useState<ActivePG | null>(null);
  const [pgError, setPgError] = useState(false);
  const [bankTransfer, setBankTransfer] = useState<BankTransferSettings | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');

  // 쿠폰 관련 state
  const [userCoupons, setUserCoupons] = useState<UserCoupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<UserCoupon | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCouponList, setShowCouponList] = useState(false);

  // 포인트 관련 state
  const [userPoints, setUserPoints] = useState(0);
  const [usePointsAmount, setUsePointsAmount] = useState(0);
  const [pointsError, setPointsError] = useState<string | null>(null);

  // 배송지 관련 state
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [showAddressList, setShowAddressList] = useState(false);

  // DB 설정값
  const [shippingConfig, setShippingConfig] = useState({ shippingFee: 3000, freeShippingThreshold: 50000 });
  const [pointConfig, setPointConfig] = useState({ minThreshold: 1000, unitAmount: 100, maxUsagePercent: 50 });

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      Promise.all([
        loadCart(),
        Promise.all([
          loadActivePG(),
          getBankTransferSettings(),
        ]).then(([pg, bt]) => {
          if (pg) { setActivePG(pg); setPaymentMethod('pg'); }
          if (bt.enabled) {
            setBankTransfer(bt);
            if (!pg) setPaymentMethod('bank_transfer');
          }
          if (!pg && !bt.enabled) setPgError(true);
        }),
        loadCoupons(),
        loadPoints(),
        loadAddresses(),
        getShippingSettings().then(setShippingConfig),
        getPointSettings().then((p) => setPointConfig({ minThreshold: p.minThreshold, unitAmount: p.unitAmount, maxUsagePercent: p.maxUsagePercent })),
      ]);
    }
  }, [user, authLoading, navigate]);

  async function loadCart() {
    try {
      if (!user) return;
      const cartItems = await getCart(user.id);
      if (cartItems.length === 0) {
        navigate('/cart');
        return;
      }
      setItems(cartItems);
    } catch (error) {
      console.error('Failed to load cart:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadCoupons() {
    try {
      if (!user) return;
      const coupons = await getUserCoupons(user.id);
      setUserCoupons(coupons);
    } catch (error) {
      console.error('Failed to load coupons:', error);
    }
  }

  async function loadPoints() {
    try {
      if (!user) return;
      const points = await getUserPoints(user.id);
      setUserPoints(points);
    } catch (error) {
      console.error('Failed to load points:', error);
    }
  }

  async function loadAddresses() {
    try {
      if (!user) return;
      const addresses = await getUserAddresses(user.id);
      setSavedAddresses(addresses);

      // 기본 배송지가 있으면 자동으로 채우기
      const defaultAddress = addresses.find((a) => a.isDefault);
      if (defaultAddress) {
        setValue('recipientName', defaultAddress.recipientName);
        setValue('recipientPhone', defaultAddress.recipientPhone);
        setValue('postalCode', defaultAddress.postalCode);
        setValue('address', defaultAddress.address1 + (defaultAddress.address2 ? ` ${defaultAddress.address2}` : ''));
      }
    } catch (error) {
      console.error('Failed to load addresses:', error);
    }
  }

  function selectAddress(address: UserAddress) {
    setValue('recipientName', address.recipientName);
    setValue('recipientPhone', address.recipientPhone);
    setValue('postalCode', address.postalCode);
    setValue('address', address.address1 + (address.address2 ? ` ${address.address2}` : ''));
    setShowAddressList(false);
  }

  const subtotal = items.reduce(
    (sum, item) => sum + (item.product?.salePrice || 0) * item.quantity,
    0
  );
  const shippingCost = subtotal >= shippingConfig.freeShippingThreshold ? 0 : shippingConfig.shippingFee;

  // 쿠폰 할인 계산
  const couponDiscount = selectedCoupon
    ? calculateCouponDiscount(selectedCoupon.coupon, subtotal).discount
    : 0;

  // 최종 결제 금액
  const total = subtotal + shippingCost - couponDiscount - usePointsAmount;

  // 쿠폰 선택 핸들러
  function handleSelectCoupon(coupon: UserCoupon | null) {
    if (!coupon) {
      setSelectedCoupon(null);
      setShowCouponList(false);
      return;
    }

    const result = calculateCouponDiscount(coupon.coupon, subtotal);
    if (!result.applicable) {
      setCouponMessage({ type: 'error', text: result.reason || '쿠폰을 적용할 수 없습니다.' });
      return;
    }

    setSelectedCoupon(coupon);
    setShowCouponList(false);
    setCouponMessage(null);
  }

  // 쿠폰 코드 등록 핸들러
  async function handleRegisterCoupon() {
    if (!user || !couponCode.trim()) return;

    const result = await registerCouponByCode(user.id, couponCode.trim());
    setCouponMessage({ type: result.success ? 'success' : 'error', text: result.message });

    if (result.success) {
      setCouponCode('');
      await loadCoupons();
    }
  }

  // 포인트 사용 핸들러
  function handlePointsChange(value: string) {
    const amount = parseInt(value) || 0;
    const unit = pointConfig.unitAmount || 100;
    const maxPct = (pointConfig.maxUsagePercent || 50) / 100;

    const adjustedAmount = Math.floor(amount / unit) * unit;

    const validation = validatePointsUsage(userPoints, adjustedAmount, subtotal + shippingCost - couponDiscount, pointConfig);
    if (!validation.valid) {
      setPointsError(validation.message || null);
      const maxUsable = Math.min(
        userPoints,
        Math.floor((subtotal + shippingCost - couponDiscount) * maxPct / unit) * unit
      );
      setUsePointsAmount(Math.min(adjustedAmount, maxUsable));
    } else {
      setPointsError(null);
      setUsePointsAmount(adjustedAmount);
    }
  }

  function handleUseAllPoints() {
    const unit = pointConfig.unitAmount || 100;
    const maxPct = (pointConfig.maxUsagePercent || 50) / 100;
    const maxUsable = Math.min(
      userPoints,
      Math.floor((subtotal + shippingCost - couponDiscount) * maxPct / unit) * unit
    );
    setUsePointsAmount(maxUsable);
    setPointsError(null);
  }

  async function onSubmit(data: CheckoutForm) {
    if (!user) return;
    if (paymentMethod === 'pg' && !activePG) return;
    if (paymentMethod === 'bank_transfer' && !bankTransfer) return;

    try {
      setSubmitting(true);

      const orderItems = items.map((item) => ({
        productId: item.productId,
        productName: item.product?.name || '',
        quantity: item.quantity,
        unitPrice: item.product?.salePrice || 0,
      }));

      const orderInfo = {
        ordererName: user.name,
        ordererPhone: data.recipientPhone,
        recipientName: data.recipientName,
        recipientPhone: data.recipientPhone,
        postalCode: data.postalCode,
        address1: data.address,
        shippingMessage: data.deliveryRequest,
        couponId: selectedCoupon?.id,
        couponDiscount,
        pointsUsed: usePointsAmount,
      };

      if (paymentMethod === 'bank_transfer') {
        // 무통장: 즉시 주문 생성 → 입금 대기 페이지로 이동
        const order = await createOrder(user.id, orderItems, orderInfo, '무통장입금');
        if (selectedCoupon) await useCoupon(selectedCoupon.id);
        if (usePointsAmount > 0) await usePoints(user.id, usePointsAmount, order.id, `주문 ${order.orderNumber} 포인트 사용`);
        navigate(`/checkout/bank-transfer?orderId=${order.id}&orderNumber=${order.orderNumber}&amount=${total}`);
        return;
      }

      // PG 결제
      const order = await createOrder(user.id, orderItems, orderInfo, activePG!.name);
      if (selectedCoupon) await useCoupon(selectedCoupon.id);
      if (usePointsAmount > 0) await usePoints(user.id, usePointsAmount, order.id, `주문 ${order.orderNumber} 포인트 사용`);

      await requestPayment(activePG!, {
        amount: total,
        orderId: order.orderNumber,
        orderName: `${items[0].product?.name || '상품'}${items.length > 1 ? ` 외 ${items.length - 1}건` : ''}`,
        customerName: data.recipientName,
        customerPhone: data.recipientPhone,
        successUrl: `${window.location.origin}/checkout/success`,
        failUrl: `${window.location.origin}/checkout/fail`,
      });
    } catch (error) {
      console.error('Failed to process payment:', error);
      alert('결제 처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <h1 className="mb-8 text-3xl font-bold">주문하기</h1>

      {pgError && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          활성화된 결제 수단이 없습니다. 관리자에게 문의해주세요.
        </div>
      )}

      {activePG && (
        <div className="mb-4 text-sm text-gray-500">
          결제 수단: <span className="font-medium text-gray-700">{activePG.name}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* 배송지 정보 */}
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xl font-bold">
                  <MapPin className="h-5 w-5" />
                  배송지 정보
                </h2>
                {savedAddresses.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddressList(!showAddressList)}
                  >
                    저장된 배송지
                    {showAddressList ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />}
                  </Button>
                )}
              </div>

              {/* 저장된 배송지 목록 */}
              {showAddressList && savedAddresses.length > 0 && (
                <div className="mb-4 space-y-2">
                  {savedAddresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => selectAddress(addr)}
                      className="w-full rounded-lg border p-3 text-left transition-colors hover:border-blue-500 hover:bg-blue-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{addr.name}</span>
                        {addr.isDefault && (
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">기본</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {addr.recipientName} · {addr.recipientPhone}
                      </p>
                      <p className="text-sm text-gray-500">
                        [{addr.postalCode}] {addr.address1} {addr.address2}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <Label htmlFor="recipientName">수령인</Label>
                  <Input
                    id="recipientName"
                    {...register('recipientName')}
                    placeholder="받으시는 분 이름"
                  />
                  {errors.recipientName && (
                    <p className="mt-1 text-sm text-red-500">{errors.recipientName.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="recipientPhone">휴대폰 번호</Label>
                  <Input
                    id="recipientPhone"
                    {...register('recipientPhone')}
                    placeholder="01012345678"
                  />
                  {errors.recipientPhone && (
                    <p className="mt-1 text-sm text-red-500">{errors.recipientPhone.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="postalCode">우편번호</Label>
                  <Input
                    id="postalCode"
                    {...register('postalCode')}
                    placeholder="12345"
                  />
                  {errors.postalCode && (
                    <p className="mt-1 text-sm text-red-500">{errors.postalCode.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="address">주소</Label>
                  <Input
                    id="address"
                    {...register('address')}
                    placeholder="상세 주소를 입력해주세요"
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-red-500">{errors.address.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="deliveryRequest">배송 요청사항 (선택)</Label>
                  <Input
                    id="deliveryRequest"
                    {...register('deliveryRequest')}
                    placeholder="배송 시 요청사항을 입력해주세요"
                  />
                </div>
              </div>
            </Card>

            {/* 주문 상품 */}
            <Card className="p-6">
              <h2 className="mb-4 text-xl font-bold">주문 상품</h2>

              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between border-b pb-4 last:border-0">
                    <div>
                      <p className="font-medium">{item.product?.name}</p>
                      <p className="text-sm text-gray-500">수량: {item.quantity}개</p>
                    </div>
                    <p className="font-bold">
                      {formatCurrency((item.product?.salePrice || 0) * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* 쿠폰 */}
            <Card className="p-6">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                <Ticket className="h-5 w-5" />
                쿠폰
              </h2>

              {/* 쿠폰 코드 입력 */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="쿠폰 코드를 입력하세요"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={handleRegisterCoupon}>
                    등록
                  </Button>
                </div>
                {couponMessage && (
                  <p className={`mt-2 text-sm ${couponMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                    {couponMessage.text}
                  </p>
                )}
              </div>

              {/* 선택된 쿠폰 표시 */}
              {selectedCoupon ? (
                <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3">
                  <div>
                    <p className="font-medium text-blue-700">{selectedCoupon.coupon.name}</p>
                    <p className="text-sm text-blue-600">
                      {selectedCoupon.coupon.discountType === 'percentage'
                        ? `${selectedCoupon.coupon.discountValue}% 할인`
                        : `${formatCurrency(selectedCoupon.coupon.discountValue)} 할인`}
                      {selectedCoupon.coupon.maxDiscountAmount &&
                        ` (최대 ${formatCurrency(selectedCoupon.coupon.maxDiscountAmount)})`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectCoupon(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowCouponList(!showCouponList)}
                    className="flex w-full items-center justify-between rounded-lg border p-3 hover:bg-gray-50"
                  >
                    <span className="text-gray-600">
                      {userCoupons.length > 0
                        ? `사용 가능한 쿠폰 ${userCoupons.length}장`
                        : '사용 가능한 쿠폰이 없습니다'}
                    </span>
                    {userCoupons.length > 0 && (
                      showCouponList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {/* 쿠폰 목록 */}
                  {showCouponList && userCoupons.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {userCoupons.map((uc) => {
                        const result = calculateCouponDiscount(uc.coupon, subtotal);
                        return (
                          <button
                            key={uc.id}
                            type="button"
                            onClick={() => handleSelectCoupon(uc)}
                            disabled={!result.applicable}
                            className={`w-full rounded-lg border p-3 text-left transition-colors ${
                              result.applicable
                                ? 'hover:border-blue-500 hover:bg-blue-50'
                                : 'cursor-not-allowed bg-gray-50 opacity-60'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{uc.coupon.name}</p>
                                <p className="text-sm text-gray-500">
                                  {uc.coupon.discountType === 'percentage'
                                    ? `${uc.coupon.discountValue}% 할인`
                                    : `${formatCurrency(uc.coupon.discountValue)} 할인`}
                                  {uc.coupon.minOrderAmount > 0 &&
                                    ` (${formatCurrency(uc.coupon.minOrderAmount)} 이상)`}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {new Date(uc.expiresAt).toLocaleDateString('ko-KR')}까지
                                </p>
                              </div>
                              {result.applicable && (
                                <span className="text-sm font-bold text-blue-600">
                                  -{formatCurrency(result.discount)}
                                </span>
                              )}
                            </div>
                            {!result.applicable && (
                              <p className="mt-1 text-xs text-red-500">{result.reason}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* 포인트 */}
            <Card className="p-6">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                <Coins className="h-5 w-5" />
                포인트
              </h2>

              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-gray-600">보유 포인트</span>
                <span className="font-medium">{userPoints.toLocaleString()}P</span>
              </div>

              {userPoints >= 1000 ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        value={usePointsAmount || ''}
                        onChange={(e) => handlePointsChange(e.target.value)}
                        placeholder="0"
                        min={0}
                        max={userPoints}
                        step={100}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">P</span>
                    </div>
                    <Button type="button" variant="outline" onClick={handleUseAllPoints}>
                      전액 사용
                    </Button>
                  </div>
                  {pointsError && (
                    <p className="text-sm text-red-500">{pointsError}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    * 100원 단위로 사용 가능, 결제금액의 50%까지 사용 가능
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  1,000포인트 이상 보유 시 사용 가능합니다.
                </p>
              )}
            </Card>
          </div>

          {/* 결제 금액 + 결제 수단 */}
          <div>
            <Card className="p-6 sticky top-4">
              <h2 className="mb-4 text-xl font-bold">결제 금액</h2>

              <div className="space-y-2 border-b pb-4">
                <div className="flex justify-between">
                  <span>상품 금액</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>배송비</span>
                  <span>{shippingCost === 0 ? '무료' : formatCurrency(shippingCost)}</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>쿠폰 할인</span>
                    <span>-{formatCurrency(couponDiscount)}</span>
                  </div>
                )}
                {usePointsAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>포인트 사용</span>
                    <span>-{formatCurrency(usePointsAmount)}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-between text-xl font-bold">
                <span>총 결제 금액</span>
                <span className="text-blue-600">{formatCurrency(total)}</span>
              </div>

              {(couponDiscount > 0 || usePointsAmount > 0) && (
                <p className="mt-2 text-right text-sm text-green-600">
                  총 {formatCurrency(couponDiscount + usePointsAmount)} 할인
                </p>
              )}

              {/* 결제 수단 선택 */}
              {(activePG || bankTransfer) && (
                <div className="mt-6">
                  <p className="mb-2 text-sm font-medium text-gray-700">결제 수단</p>
                  <div className="grid gap-2">
                    {activePG && (
                      <label className={`flex cursor-pointer items-center gap-3 rounded-md border-2 p-3 transition-colors ${paymentMethod === 'pg' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                        <input type="radio" className="sr-only" checked={paymentMethod === 'pg'} onChange={() => setPaymentMethod('pg')} />
                        <span className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${paymentMethod === 'pg' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`} />
                        <div>
                          <p className="text-sm font-medium">{activePG.name}</p>
                          <p className="text-xs text-gray-500">카드, 간편결제 등</p>
                        </div>
                      </label>
                    )}
                    {bankTransfer && (
                      <label className={`flex cursor-pointer items-center gap-3 rounded-md border-2 p-3 transition-colors ${paymentMethod === 'bank_transfer' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                        <input type="radio" className="sr-only" checked={paymentMethod === 'bank_transfer'} onChange={() => setPaymentMethod('bank_transfer')} />
                        <span className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${paymentMethod === 'bank_transfer' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`} />
                        <div>
                          <p className="text-sm font-medium">무통장입금</p>
                          <p className="text-xs text-gray-500">{bankTransfer.bankName} · {bankTransfer.accountHolder}</p>
                        </div>
                      </label>
                    )}
                  </div>

                  {/* 무통장 선택 시 계좌 안내 */}
                  {paymentMethod === 'bank_transfer' && bankTransfer && (
                    <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm">
                      <p className="font-medium text-gray-700 mb-1">입금 계좌 정보</p>
                      <p className="text-gray-600">{bankTransfer.bankName} {bankTransfer.accountNumber}</p>
                      <p className="text-gray-600">예금주: {bankTransfer.accountHolder}</p>
                      <p className="mt-1 text-xs text-orange-600">주문 후 {bankTransfer.depositDeadlineHours}시간 이내 입금 필요 (미입금 시 자동 취소)</p>
                    </div>
                  )}
                </div>
              )}

              {!activePG && !bankTransfer && (
                <p className="mt-4 text-sm text-red-500">활성화된 결제 수단이 없습니다. 관리자에게 문의해주세요.</p>
              )}

              <Button
                type="submit"
                className="mt-6 w-full"
                size="lg"
                disabled={submitting || (!activePG && !bankTransfer)}
              >
                {submitting
                  ? '처리 중...'
                  : paymentMethod === 'bank_transfer'
                  ? '무통장입금 주문하기'
                  : `${activePG?.name || 'PG'} 결제하기`}
              </Button>

              <p className="mt-4 text-center text-xs text-gray-500">
                주문 내용을 확인하였으며, 결제에 동의합니다.
              </p>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
