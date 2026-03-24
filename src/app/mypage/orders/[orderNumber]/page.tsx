import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  shippingCost: number;
  shippingAddress: string;
  recipientName: string;
  recipientPhone: string;
  deliveryRequest?: string;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: '결제 대기', variant: 'secondary' },
  paid: { label: '결제 완료', variant: 'default' },
  preparing: { label: '배송 준비중', variant: 'default' },
  shipping: { label: '배송중', variant: 'default' },
  delivered: { label: '배송 완료', variant: 'outline' },
  cancelled: { label: '취소됨', variant: 'destructive' },
};

export default function OrderDetailPage() {
  const navigate = useNavigate();
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

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
      const response = await fetch(`/api/orders/${orderNumber}`);
      const data = await response.json();

      if (data.success) {
        setOrder(data.data);
      } else {
        alert(data.error || '주문 정보를 불러올 수 없습니다.');
        navigate('/mypage/orders');
      }
    } catch (error) {
      console.error('Failed to load order:', error);
      alert('주문 정보를 불러오는 중 오류가 발생했습니다.');
      navigate('/mypage/orders');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelOrder() {
    if (!confirm('주문을 취소하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/orders/${orderNumber}/cancel`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '주문 취소에 실패했습니다.');
      }

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
        </div>
        {canCancel && (
          <Button variant="destructive" onClick={handleCancelOrder}>
            주문 취소
          </Button>
        )}
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
    </div>
  );
}
