import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Receipt, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  getCashReceipts,
  createCashReceipt,
  type CashReceipt,
  type CashReceiptType,
  type IdentityType,
} from '@/services/cashReceipt';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  pending: { label: '발급대기', variant: 'secondary' },
  issued: { label: '발급완료', variant: 'default' },
  cancelled: { label: '취소', variant: 'outline' },
};

const typeLabels: Record<CashReceiptType, string> = {
  income: '소득공제',
  expense: '지출증빙',
};

const identityTypeLabels: Record<IdentityType, string> = {
  phone: '휴대폰번호',
  business: '사업자번호',
  card: '현금영수증카드',
};

interface AvailableOrder {
  id: string;
  orderNumber: string;
  totalAmount: number;
}

export default function CashReceiptsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [receipts, setReceipts] = useState<CashReceipt[]>([]);
  const [loading, setLoading] = useState(true);

  // 발급 폼
  const [showForm, setShowForm] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);
  const [formData, setFormData] = useState({
    orderId: '',
    type: 'income' as CashReceiptType,
    identityType: 'phone' as IdentityType,
    identityNumber: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadReceipts();
    }
  }, [user, authLoading, navigate]);

  async function loadReceipts() {
    try {
      const data = await getCashReceipts(user!.id);
      setReceipts(data);
    } catch (err) {
      console.error('현금영수증 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailableOrders() {
    const supabase = createClient();

    // 결제 완료된 주문 중 현금영수증이 없는 것
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, total_amount')
      .eq('user_id', user!.id)
      .in('status', ['paid', 'preparing', 'shipping', 'delivered'])
      .order('created_at', { ascending: false });

    if (!orders || orders.length === 0) {
      setAvailableOrders([]);
      return;
    }

    // 이미 발급된 주문 제외
    const existingReceiptOrderIds = new Set(receipts.map((r) => r.orderId));
    const available = orders
      .filter((o: any) => !existingReceiptOrderIds.has(o.id))
      .map((o: any) => ({
        id: o.id,
        orderNumber: o.order_number,
        totalAmount: o.total_amount,
      }));

    setAvailableOrders(available);
  }

  function handleOpenForm() {
    setShowForm(true);
    setMessage(null);
    setFormData({ orderId: '', type: 'income', identityType: 'phone', identityNumber: '' });
    loadAvailableOrders();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.orderId || !formData.identityNumber.trim()) {
      setMessage({ type: 'error', text: '모든 필드를 입력해주세요.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);

    try {
      await createCashReceipt(formData);
      setMessage({ type: 'success', text: '현금영수증 발급이 요청되었습니다.' });
      setShowForm(false);
      await loadReceipts();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '발급 요청 중 오류가 발생했습니다.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  function maskIdentity(value: string) {
    if (value.length <= 4) return value;
    return value.slice(0, -4).replace(/./g, '*') + value.slice(-4);
  }

  if (authLoading || loading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">현금영수증</h1>
        <Button size="sm" onClick={handleOpenForm}>
          <Plus className="mr-1.5 h-4 w-4" />
          발급 요청
        </Button>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-md px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 발급 요청 폼 */}
      {showForm && (
        <Card className="mb-6 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">현금영수증 발급 요청</h2>
            <button onClick={() => setShowForm(false)}>
              <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>주문 선택</Label>
              <select
                value={formData.orderId}
                onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                required
              >
                <option value="">주문을 선택해주세요</option>
                {availableOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNumber} ({formatCurrency(order.totalAmount)})
                  </option>
                ))}
              </select>
              {availableOrders.length === 0 && (
                <p className="mt-1 text-xs text-gray-500">발급 가능한 주문이 없습니다.</p>
              )}
            </div>

            <div>
              <Label>발급 용도</Label>
              <div className="mt-1 flex gap-4">
                {(['income', 'expense'] as CashReceiptType[]).map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="receiptType"
                      value={t}
                      checked={formData.type === t}
                      onChange={() => setFormData({ ...formData, type: t })}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{typeLabels[t]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>식별 유형</Label>
              <select
                value={formData.identityType}
                onChange={(e) =>
                  setFormData({ ...formData, identityType: e.target.value as IdentityType })
                }
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                {(Object.entries(identityTypeLabels) as [IdentityType, string][]).map(
                  ([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <Label>
                {formData.identityType === 'phone'
                  ? '휴대폰 번호'
                  : formData.identityType === 'business'
                  ? '사업자등록번호'
                  : '카드번호'}
              </Label>
              <Input
                value={formData.identityNumber}
                onChange={(e) =>
                  setFormData({ ...formData, identityNumber: e.target.value.replace(/[^0-9-]/g, '') })
                }
                placeholder={
                  formData.identityType === 'phone'
                    ? '010-1234-5678'
                    : formData.identityType === 'business'
                    ? '123-45-67890'
                    : '카드번호 입력'
                }
                className="mt-1"
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                취소
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '요청 중...' : '발급 요청'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* 현금영수증 목록 */}
      {receipts.length === 0 ? (
        <Card className="p-12 text-center">
          <Receipt className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">발급된 현금영수증이 없습니다.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {receipts.map((receipt) => {
            const statusInfo = statusLabels[receipt.status] || statusLabels.pending;
            return (
              <Card key={receipt.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{receipt.orderNumber}</span>
                      <Badge variant={statusInfo.variant} className="text-xs">
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <p className="text-lg font-bold">{formatCurrency(receipt.amount)}</p>
                    <div className="mt-1 flex gap-3 text-xs text-gray-500">
                      <span>{typeLabels[receipt.type]}</span>
                      <span>
                        {identityTypeLabels[receipt.identityType]}: {maskIdentity(receipt.identityNumber)}
                      </span>
                    </div>
                    {receipt.approvalNumber && (
                      <p className="mt-1 text-xs text-gray-400">
                        승인번호: {receipt.approvalNumber}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>{format(new Date(receipt.createdAt), 'yyyy.MM.dd')}</p>
                    {receipt.issuedAt && (
                      <p className="text-green-600">
                        발급일: {format(new Date(receipt.issuedAt), 'yyyy.MM.dd')}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
