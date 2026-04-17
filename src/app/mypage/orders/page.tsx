import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ArrowLeft, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  shippingCost: number;
  createdAt: string;
  items?: Array<{
    id: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
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

export default function OrdersPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadOrders();
    }
  }, [user, authLoading, navigate]);

  async function loadOrders() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, total_amount, shipping_fee, created_at,
          order_items(id, product_name, quantity, unit_price)
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(
        (data || []).map((o: any) => ({
          id: o.id,
          orderNumber: o.order_number,
          status: o.status,
          totalAmount: o.total_amount,
          shippingCost: o.shipping_fee,
          createdAt: o.created_at,
          items: (o.order_items || []).map((i: any) => ({
            id: i.id,
            productName: i.product_name,
            quantity: i.quantity,
            price: i.unit_price,
          })),
        }))
      );
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelOrder(orderNumber: string) {
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
      await loadOrders();
    } catch (error) {
      console.error('Failed to cancel order:', error);
      alert(error instanceof Error ? error.message : '주문 취소 중 오류가 발생했습니다.');
    }
  }

  if (authLoading || loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <Link to="/mypage" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        마이페이지로 돌아가기
      </Link>

      <h1 className="mb-8 text-3xl font-bold">주문 내역</h1>

      {orders.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <p className="mb-4 text-gray-500">주문 내역이 없습니다.</p>
          <Link to="/products">
            <Button>쇼핑하러 가기</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusInfo = statusLabels[order.status] || { label: order.status, variant: 'default' as const };
            const canCancel = order.status === 'pending' || order.status === 'paid';

            return (
              <Card key={order.id} className="p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="font-bold">주문번호: {order.orderNumber}</h3>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      {format(new Date(order.createdAt), 'yyyy년 MM월 dd일 HH:mm')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">총 결제금액</p>
                    <p className="text-xl font-bold">{formatCurrency(order.totalAmount)}</p>
                  </div>
                </div>

                {order.items && order.items.length > 0 && (
                  <div className="mb-4 border-t pt-4">
                    <h4 className="mb-2 text-sm font-medium text-gray-700">주문 상품</h4>
                    <div className="space-y-2">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span>
                            {item.productName} × {item.quantity}
                          </span>
                          <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Link to={`/mypage/orders/${order.orderNumber}`} className="flex-1">
                    <Button variant="outline" className="w-full">
                      상세보기
                    </Button>
                  </Link>
                  {canCancel && (
                    <Button
                      variant="ghost"
                      className="text-red-500"
                      onClick={() => handleCancelOrder(order.orderNumber)}
                    >
                      취소하기
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
