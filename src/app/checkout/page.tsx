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
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { CartItem } from '@/types';

interface ActivePG {
  provider: string;
  name: string;
  clientKey: string;
}

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
      .single();

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
      // 팝업/리다이렉트 방식 - 각 PG SDK 연동 필요
      // 현재는 기본 구현 제공, 실제 SDK로 교체 필요
      alert(`${pg.name} SDK가 아직 연동되지 않았습니다. PG사 개발 문서를 참고하세요.`);
      break;
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

  const {
    register,
    handleSubmit,
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
      Promise.all([loadCart(), loadActivePG().then((pg) => {
        if (!pg) setPgError(true);
        else setActivePG(pg);
      })]);
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

  const subtotal = items.reduce(
    (sum, item) => sum + (item.product?.salePrice || 0) * item.quantity,
    0
  );
  const shippingCost = subtotal >= 50000 ? 0 : 3000;
  const total = subtotal + shippingCost;

  async function onSubmit(data: CheckoutForm) {
    if (!user || !activePG) return;

    try {
      setSubmitting(true);

      const order = await createOrder(
        user.id,
        items.map((item) => ({
          productId: item.productId,
          productName: item.product?.name || '',
          quantity: item.quantity,
          unitPrice: item.product?.salePrice || 0,
        })),
        {
          ordererName: user.name,
          ordererPhone: data.recipientPhone,
          recipientName: data.recipientName,
          recipientPhone: data.recipientPhone,
          postalCode: data.postalCode,
          address1: data.address,
          shippingMessage: data.deliveryRequest,
        },
        activePG.name
      );

      await requestPayment(activePG, {
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
              <h2 className="mb-4 text-xl font-bold">배송지 정보</h2>

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
          </div>

          {/* 결제 금액 */}
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
              </div>

              <div className="mt-4 flex justify-between text-xl font-bold">
                <span>총 결제 금액</span>
                <span className="text-blue-600">{formatCurrency(total)}</span>
              </div>

              <Button
                type="submit"
                className="mt-6 w-full"
                size="lg"
                disabled={submitting || pgError || !activePG}
              >
                {submitting ? '처리 중...' : `${activePG?.name || 'PG'} 결제하기`}
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
