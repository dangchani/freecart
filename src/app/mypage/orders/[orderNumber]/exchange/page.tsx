import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  items: OrderItem[];
}

const exchangeReasons = [
  '사이즈 교환',
  '색상 교환',
  '상품 불량',
  '오배송',
  '기타',
];

export default function ExchangeRequestPage() {
  const navigate = useNavigate();
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 선택된 아이템
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadOrder();
    }
  }, [user, authLoading, navigate]);

  async function loadOrder() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status,
          order_items(id, product_id, product_name, quantity, unit_price)
        `)
        .eq('order_number', orderNumber)
        .eq('user_id', user!.id)
        .single();

      if (error || !data) {
        alert('주문 정보를 불러올 수 없습니다.');
        navigate('/mypage/orders');
        return;
      }

      if (data.status !== 'delivered') {
        alert('배송 완료된 주문만 교환 신청이 가능합니다.');
        navigate(`/mypage/orders/${orderNumber}`);
        return;
      }

      setOrder({
        id: data.id,
        orderNumber: data.order_number,
        status: data.status,
        items: (data.order_items || []).map((i: any) => ({
          id: i.id,
          productId: i.product_id,
          productName: i.product_name,
          quantity: i.quantity,
          price: i.unit_price,
        })),
      });

      // 기본으로 첫 번째 아이템 선택
      if (data.order_items?.length > 0) {
        setSelectedItems([data.order_items[0].id]);
      }
    } catch (error) {
      console.error('Failed to load order:', error);
      navigate('/mypage/orders');
    } finally {
      setLoading(false);
    }
  }

  function toggleItem(itemId: string) {
    setSelectedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (selectedItems.length === 0) {
      alert('교환할 상품을 선택해주세요.');
      return;
    }

    if (!reason) {
      alert('교환 사유를 선택해주세요.');
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.from('exchanges').insert({
        order_id: order!.id,
        user_id: user!.id,
        item_ids: selectedItems,
        reason,
        status: 'pending',
      });

      if (error) throw error;

      alert('교환 신청이 완료되었습니다. 관리자 승인 후 처리됩니다.');
      navigate(`/mypage/orders/${orderNumber}`);
    } catch (error) {
      console.error('Failed to submit exchange:', error);
      alert('교환 신청 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  if (!order) {
    return null;
  }

  return (
    <div>
      <Link
        to={`/mypage/orders/${orderNumber}`}
        className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        주문 상세로 돌아가기
      </Link>

      <h1 className="mb-6 text-2xl font-bold">교환 신청</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 상품 선택 */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">교환할 상품 선택</h2>
          <div className="space-y-3">
            {order.items.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedItems.includes(item.id)}
                  onChange={() => toggleItem(item.id)}
                  className="h-5 w-5 rounded border-gray-300"
                />
                <div className="flex-1">
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-sm text-gray-500">
                    {formatCurrency(item.price)} × {item.quantity}개
                  </p>
                </div>
                <p className="font-bold">{formatCurrency(item.price * item.quantity)}</p>
              </label>
            ))}
          </div>
        </Card>

        {/* 교환 사유 */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">교환 사유</h2>
          <div className="space-y-2">
            {exchangeReasons.map((r) => (
              <label
                key={r}
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-gray-50"
              >
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-4 w-4 border-gray-300"
                />
                <span>{r}</span>
              </label>
            ))}
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium">희망 교환 옵션 (선택)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: L 사이즈로 교환 희망합니다 / 블랙 색상으로 교환 희망합니다"
              className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
        </Card>

        {/* 안내 사항 */}
        <Card className="bg-gray-50 p-6">
          <h3 className="mb-3 font-semibold">교환 안내</h3>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• 교환 신청 후 관리자 승인 절차가 진행됩니다.</li>
            <li>• 동일 상품의 다른 옵션(사이즈, 색상 등)으로 교환 가능합니다.</li>
            <li>• 단순 변심의 경우 왕복 배송비가 부과될 수 있습니다.</li>
            <li>• 상품 불량/오배송의 경우 무료로 교환 처리됩니다.</li>
            <li>• 교환 상품의 재고가 없는 경우 환불 처리될 수 있습니다.</li>
          </ul>
        </Card>

        {/* 제출 버튼 */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/mypage/orders/${orderNumber}`)}
          >
            취소
          </Button>
          <Button type="submit" disabled={submitting || selectedItems.length === 0 || !reason}>
            {submitting ? '처리 중...' : '교환 신청'}
          </Button>
        </div>
      </form>
    </div>
  );
}
