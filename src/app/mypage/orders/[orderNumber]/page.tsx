import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ArrowLeft, RotateCcw, RefreshCw, Truck, ExternalLink, Package, CheckCircle2, Clock, Edit2, X, Check, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { updateOrderShipping, transitionOrderStatus } from '@/services/orders';
import { getCustomerRequestSettings } from '@/services/settings';

interface ShipmentInfo {
  id: string;
  trackingNumber: string | null;
  status: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  shippingCompany: {
    name: string;
    code: string;
    trackingUrl: string | null;
  } | null;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  shippingCost: number;
  postalCode: string;
  shippingAddress: string;
  address1: string;
  address2: string;
  recipientName: string;
  recipientPhone: string;
  deliveryRequest?: string;
  createdAt: string;
  autoConfirmAt?: string | null;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
  shipment?: ShipmentInfo;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending:          { label: '결제 대기',   variant: 'secondary' },
  paid:             { label: '결제 완료',   variant: 'default' },
  processing:       { label: '상품 준비중', variant: 'default' },
  preparing:        { label: '배송 준비중', variant: 'default' },
  shipped:          { label: '배송중',      variant: 'default' },
  transferred:      { label: '배송중',      variant: 'default' },
  picked_up:        { label: '배송중',      variant: 'default' },
  out_for_delivery: { label: '배송 출발',   variant: 'default' },
  shipping:         { label: '배송중',      variant: 'default' },
  delivered:        { label: '배송 완료',   variant: 'outline' },
  confirmed:        { label: '구매확정',    variant: 'outline' },
  cancelled:        { label: '취소됨',      variant: 'destructive' },
  refunded:         { label: '환불완료',    variant: 'destructive' },
  exchange_requested: { label: '교환 신청', variant: 'secondary' },
  return_requested: { label: '반품 신청',   variant: 'secondary' },
  returned:         { label: '반품완료',    variant: 'secondary' },
};

export default function OrderDetailPage() {
  const navigate = useNavigate();
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowCustomerReturn,   setAllowCustomerReturn]   = useState(true);
  const [allowCustomerExchange, setAllowCustomerExchange] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [shippingModal, setShippingModal] = useState(false);
  const [shippingEdit, setShippingEdit] = useState({ recipientName: '', recipientPhone: '', postalCode: '', address1: '', address2: '', shippingMessage: '' });
  const [savingShipping, setSavingShipping] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadOrderDetail();
    }
  }, [user, authLoading, navigate]);

  async function loadOrderDetail() {
    try {
      const supabase = createClient();
      getCustomerRequestSettings().then((s) => {
        setAllowCustomerReturn(s.allowCustomerReturn);
        setAllowCustomerExchange(s.allowCustomerExchange);
      });
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, total_amount, shipping_fee,
          address1, address2, postal_code, recipient_name, recipient_phone,
          shipping_message, created_at, auto_confirm_at,
          order_items(id, product_name, quantity, unit_price)
        `)
        .eq('order_number', orderNumber)
        .eq('user_id', user!.id)
        .single();

      if (error || !data) {
        alert('주문 정보를 불러올 수 없습니다.');
        navigate('/mypage/orders');
        return;
      }

      // 배송 정보 조회
      const { data: shipmentData } = await supabase
        .from('shipments')
        .select(`
          id, tracking_number, status, shipped_at, delivered_at,
          shipping_companies(name, code, tracking_url)
        `)
        .eq('order_id', data.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let shipment: ShipmentInfo | undefined;
      if (shipmentData) {
        const company = shipmentData.shipping_companies as any;
        shipment = {
          id: shipmentData.id,
          trackingNumber: shipmentData.tracking_number,
          status: shipmentData.status,
          shippedAt: shipmentData.shipped_at,
          deliveredAt: shipmentData.delivered_at,
          shippingCompany: company ? {
            name: company.name,
            code: company.code,
            trackingUrl: company.tracking_url,
          } : null,
        };
      }

      setOrder({
        id: data.id,
        orderNumber: data.order_number,
        status: data.status,
        totalAmount: data.total_amount,
        shippingCost: data.shipping_fee,
        postalCode: data.postal_code,
        shippingAddress: [data.address1, data.address2].filter(Boolean).join(' '),
        address1: data.address1,
        address2: data.address2 ?? '',
        recipientName: data.recipient_name,
        recipientPhone: data.recipient_phone,
        deliveryRequest: data.shipping_message,
        createdAt: data.created_at,
        autoConfirmAt: data.auto_confirm_at ?? null,
        items: (data.order_items || []).map((i: any) => ({
          id: i.id,
          productName: i.product_name,
          quantity: i.quantity,
          price: i.unit_price,
        })),
        shipment,
      });
    } catch (error) {
      console.error('Failed to load order:', error);
      alert('주문 정보를 불러오는 중 오류가 발생했습니다.');
      navigate('/mypage/orders');
    } finally {
      setLoading(false);
    }
  }

  function openShippingEdit() {
    if (!order) return;
    setShippingEdit({
      recipientName:   order.recipientName,
      recipientPhone:  order.recipientPhone,
      postalCode:      order.postalCode,
      address1:        order.address1,
      address2:        order.address2,
      shippingMessage: order.deliveryRequest ?? '',
    });
    setShippingModal(true);
  }

  async function handleSaveShipping() {
    if (!order) return;
    setSavingShipping(true);
    try {
      await updateOrderShipping(order.id, shippingEdit, user?.id);
      setShippingModal(false);
      await loadOrderDetail();
      alert('배송지가 수정되었습니다.');
    } catch (err: any) {
      alert(err.message ?? '배송지 수정 중 오류가 발생했습니다.');
    } finally {
      setSavingShipping(false);
    }
  }

  async function handleConfirmOrder() {
    if (!order) return;
    if (!confirm('구매확정 하시겠습니까?\n확정 후에는 반품/교환 신청이 어려울 수 있습니다.')) return;
    setConfirming(true);
    try {
      await transitionOrderStatus(order.id, 'confirmed', { note: '고객 구매확정', changedBy: user?.id });
      await loadOrderDetail();
      alert('구매확정이 완료되었습니다.');
    } catch (err) {
      alert(err instanceof Error ? err.message : '구매확정 중 오류가 발생했습니다.');
    } finally {
      setConfirming(false);
    }
  }

  async function handleCancelOrder() {
    if (!confirm('주문을 취소하시겠습니까?')) {
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('order_number', orderNumber)
        .eq('user_id', user!.id)
        .in('status', ['pending', 'paid']);

      if (error) throw error;

      alert('주문이 취소되었습니다.');
      await loadOrderDetail();
    } catch (error) {
      console.error('Failed to cancel order:', error);
      alert(error instanceof Error ? error.message : '주문 취소 중 오류가 발생했습니다.');
    }
  }

  if (authLoading || loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  if (!order) {
    return <div className="container py-8">주문 정보를 찾을 수 없습니다.</div>;
  }

  const statusInfo = statusLabels[order.status] || { label: order.status, variant: 'default' as const };
  const canCancel = order.status === 'pending' || order.status === 'paid';
  const canEditShipping = order.status === 'pending';
  const canConfirm  = order.status === 'delivered';
  const canReturn   = order.status === 'delivered';
  const canExchange = order.status === 'delivered';
  const subtotal = order.totalAmount - order.shippingCost;

  return (
    <div className="container py-8">
      <Link to="/mypage/orders" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        주문 내역으로 돌아가기
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold">주문 상세</h1>
          <div className="flex items-center gap-2">
            <p className="text-gray-600">주문번호: {order.orderNumber}</p>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
          {order.status === 'delivered' && order.autoConfirmAt && (
            <p className="mt-1 text-xs text-gray-400">
              자동 구매확정: {format(new Date(order.autoConfirmAt), 'yyyy-MM-dd')}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {canEditShipping && (
            <Button variant="outline" onClick={openShippingEdit}>
              <Edit2 className="mr-1.5 h-4 w-4" />배송지 수정
            </Button>
          )}
          {canCancel && (
            <Button variant="destructive" onClick={handleCancelOrder}>
              주문 취소
            </Button>
          )}
          {order.status === 'delivered' && (
            <>
              {canReturn && (
                allowCustomerReturn ? (
                  <Button variant="outline" asChild>
                    <Link to={`/mypage/orders/${order.orderNumber}/return`}>
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      반품 신청
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => alert('현재 온라인 반품 신청이 제한되어 있습니다.\n고객센터로 문의해 주세요.')}>
                    <RotateCcw className="mr-1.5 h-4 w-4" />
                    반품 신청
                  </Button>
                )
              )}
              {canExchange && (
                allowCustomerExchange ? (
                  <Button variant="outline" asChild>
                    <Link to={`/mypage/orders/${order.orderNumber}/exchange`}>
                      <RefreshCw className="mr-1.5 h-4 w-4" />
                      교환 신청
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => alert('현재 온라인 교환 신청이 제한되어 있습니다.\n고객센터로 문의해 주세요.')}>
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                    교환 신청
                  </Button>
                )
              )}
              {canConfirm && (
                <Button onClick={handleConfirmOrder} disabled={confirming}>
                  <ShieldCheck className="mr-1.5 h-4 w-4" />
                  {confirming ? '처리 중...' : '구매확정'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* 주문 상품 */}
          <Card className="p-6">
            <h2 className="mb-4 text-xl font-bold">주문 상품</h2>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between border-b pb-4 last:border-0">
                  <div>
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(item.price)} × {item.quantity}개
                    </p>
                  </div>
                  <p className="font-bold">{formatCurrency(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* 배송 추적 */}
          {(order.status === 'shipped' || order.status === 'delivered' || order.shipment) && (
            <Card className="p-6">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
                <Truck className="h-5 w-5" />
                배송 정보
              </h2>

              {order.shipment ? (
                <div className="space-y-4">
                  {/* 배송 상태 타임라인 */}
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                    <div className="flex items-center gap-3">
                      {order.shipment.status === 'delivered' ? (
                        <CheckCircle2 className="h-8 w-8 text-green-500" />
                      ) : ['shipped', 'transferred', 'picked_up', 'out_for_delivery'].includes(order.shipment.status) ? (
                        <Truck className="h-8 w-8 text-blue-500" />
                      ) : (
                        <Package className="h-8 w-8 text-gray-400" />
                      )}
                      <div>
                        <p className="font-semibold">
                          {order.shipment.status === 'delivered' && '배송 완료'}
                          {order.shipment.status === 'out_for_delivery' && '배송 출발'}
                          {['shipped', 'transferred', 'picked_up'].includes(order.shipment.status) && '배송 중'}
                          {order.shipment.status === 'pending' && '배송 준비 중'}
                        </p>
                        {order.shipment.deliveredAt && (
                          <p className="text-sm text-gray-500">
                            {format(new Date(order.shipment.deliveredAt), 'yyyy-MM-dd HH:mm')} 배송 완료
                          </p>
                        )}
                        {order.shipment.shippedAt && !order.shipment.deliveredAt && (
                          <p className="text-sm text-gray-500">
                            {format(new Date(order.shipment.shippedAt), 'yyyy-MM-dd HH:mm')} 출고
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 배송사 정보 */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">배송사</span>
                      <span className="font-medium">{order.shipment.shippingCompany?.name || '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">운송장 번호</span>
                      <span className="font-medium font-mono">{order.shipment.trackingNumber || '-'}</span>
                    </div>
                  </div>

                  {/* 배송 추적 버튼 */}
                  {order.shipment.trackingNumber && order.shipment.shippingCompany?.trackingUrl && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        const url = order.shipment!.shippingCompany!.trackingUrl!.replace(
                          '{tracking_number}',
                          order.shipment!.trackingNumber!
                        );
                        window.open(url, '_blank');
                      }}
                    >
                      <ExternalLink className="mr-1.5 h-4 w-4" />
                      배송 추적하기
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-4">
                  <Clock className="h-6 w-6 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-700">배송 준비 중</p>
                    <p className="text-sm text-gray-500">운송장 번호가 등록되면 배송 추적이 가능합니다.</p>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* 배송지 정보 */}
          <Card className="p-6">
            <h2 className="mb-4 text-xl font-bold">배송지 정보</h2>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-gray-600">수령인:</span>
                <span className="ml-2 font-medium">{order.recipientName}</span>
              </div>
              <div>
                <span className="text-sm text-gray-600">연락처:</span>
                <span className="ml-2 font-medium">{order.recipientPhone}</span>
              </div>
              <div>
                <span className="text-sm text-gray-600">주소:</span>
                <span className="ml-2 font-medium">{order.shippingAddress}</span>
              </div>
              {order.deliveryRequest && (
                <div>
                  <span className="text-sm text-gray-600">배송 요청사항:</span>
                  <span className="ml-2 font-medium">{order.deliveryRequest}</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* 결제 정보 */}
        <div>
          <Card className="p-6">
            <h2 className="mb-4 text-xl font-bold">결제 정보</h2>

            <div className="space-y-2 border-b pb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">주문일시</span>
                <span>{format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">상품 금액</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">배송비</span>
                <span>{order.shippingCost === 0 ? '무료' : formatCurrency(order.shippingCost)}</span>
              </div>
            </div>

            <div className="mt-4 flex justify-between text-xl font-bold">
              <span>총 결제금액</span>
              <span className="text-blue-600">{formatCurrency(order.totalAmount)}</span>
            </div>
          </Card>
        </div>
      </div>

      {/* 배송지 수정 모달 */}
      {shippingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">배송지 수정</h2>
              <button onClick={() => setShippingModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <p className="text-xs text-blue-600 bg-blue-50 rounded p-2">입금 전 주문에만 배송지 수정이 가능합니다.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">수령인 <span className="text-red-500">*</span></label>
                  <Input value={shippingEdit.recipientName} onChange={(e) => setShippingEdit((p) => ({ ...p, recipientName: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">연락처 <span className="text-red-500">*</span></label>
                  <Input value={shippingEdit.recipientPhone} onChange={(e) => setShippingEdit((p) => ({ ...p, recipientPhone: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">우편번호 <span className="text-red-500">*</span></label>
                <Input value={shippingEdit.postalCode} onChange={(e) => setShippingEdit((p) => ({ ...p, postalCode: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">주소 <span className="text-red-500">*</span></label>
                <Input value={shippingEdit.address1} onChange={(e) => setShippingEdit((p) => ({ ...p, address1: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">상세주소</label>
                <Input value={shippingEdit.address2} onChange={(e) => setShippingEdit((p) => ({ ...p, address2: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">배송 메시지</label>
                <Input value={shippingEdit.shippingMessage} onChange={(e) => setShippingEdit((p) => ({ ...p, shippingMessage: e.target.value }))} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShippingModal(false)}>닫기</Button>
              <Button
                onClick={handleSaveShipping}
                disabled={savingShipping || !shippingEdit.recipientName || !shippingEdit.address1}>
                <Check className="mr-2 h-4 w-4" />{savingShipping ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
