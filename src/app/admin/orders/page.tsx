import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  customerName: string;
  createdAt: string;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: '결제 대기', variant: 'secondary' },
  paid: { label: '결제 완료', variant: 'default' },
  preparing: { label: '배송 준비중', variant: 'default' },
  shipping: { label: '배송중', variant: 'default' },
  delivered: { label: '배송 완료', variant: 'outline' },
  cancelled: { label: '취소됨', variant: 'destructive' },
};

const statusOptions = [
  { value: 'pending', label: '결제 대기' },
  { value: 'paid', label: '결제 완료' },
  { value: 'preparing', label: '배송 준비중' },
  { value: 'shipping', label: '배송중' },
  { value: 'delivered', label: '배송 완료' },
];

export default function AdminOrdersPage() {
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
      const response = await fetch('/api/orders?admin=true');
      const data = await response.json();

      if (data.success) {
        setOrders(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(orderId: string, newStatus: string) {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '주문 상태 변경에 실패했습니다.');
      }

      await loadOrders();
    } catch (error) {
      console.error('Failed to update order status:', error);
      alert(error instanceof Error ? error.message : '주문 상태 변경 중 오류가 발생했습니다.');
    }
  }

  if (authLoading || loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <Link to="/admin" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        대시보드로 돌아가기
      </Link>

      <h1 className="mb-6 text-3xl font-bold">주문 관리</h1>

      {orders.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">주문 내역이 없습니다.</p>
        </Card>
      ) : (
        <Card>
          <div className="divide-y">
            {orders.map((order) => {
              const statusInfo = statusLabels[order.status] || { label: order.status, variant: 'default' as const };

              return (
                <div key={order.id} className="p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="font-bold">주문번호: {order.orderNumber}</h3>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <span>{order.customerName}</span>
                        <span>{format(new Date(order.createdAt), 'yyyy.MM.dd HH:mm')}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(order.totalAmount)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={order.status}
                      onValueChange={(value) => handleStatusChange(order.id, value)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Link to={`/mypage/orders/${order.orderNumber}`}>
                      <Button size="sm" variant="outline">
                        상세보기
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
