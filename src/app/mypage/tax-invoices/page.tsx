import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  getTaxInvoices,
  createTaxInvoice,
  type TaxInvoice,
} from '@/services/taxInvoice';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  pending: { label: '발급대기', variant: 'secondary' },
  issued: { label: '발급완료', variant: 'default' },
  cancelled: { label: '취소', variant: 'outline' },
};

interface AvailableOrder {
  id: string;
  orderNumber: string;
  totalAmount: number;
}

const emptyForm = {
  orderId: '',
  businessNumber: '',
  companyName: '',
  ceoName: '',
  businessAddress: '',
  businessType: '',
  businessCategory: '',
  email: '',
};

export default function TaxInvoicesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [invoices, setInvoices] = useState<TaxInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  // 발급 폼
  const [showForm, setShowForm] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadInvoices();
    }
  }, [user, authLoading, navigate]);

  async function loadInvoices() {
    try {
      const data = await getTaxInvoices(user!.id);
      setInvoices(data);
    } catch (err) {
      console.error('세금계산서 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailableOrders() {
    const supabase = createClient();

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

    const existingInvoiceOrderIds = new Set(invoices.map((inv) => inv.orderId));
    const available = orders
      .filter((o: any) => !existingInvoiceOrderIds.has(o.id))
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
    setFormData(emptyForm);
    loadAvailableOrders();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { orderId, businessNumber, companyName, ceoName, businessAddress, email } = formData;
    if (!orderId || !businessNumber || !companyName || !ceoName || !businessAddress || !email) {
      setMessage({ type: 'error', text: '필수 항목을 모두 입력해주세요.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);

    try {
      await createTaxInvoice(formData);
      setMessage({ type: 'success', text: '세금계산서 발급이 요청되었습니다.' });
      setShowForm(false);
      await loadInvoices();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '발급 요청 중 오류가 발생했습니다.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  function updateForm(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  if (authLoading || loading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">세금계산서</h1>
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
            <h2 className="font-semibold">세금계산서 발급 요청</h2>
            <button onClick={() => setShowForm(false)}>
              <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>주문 선택 *</Label>
              <select
                value={formData.orderId}
                onChange={(e) => updateForm('orderId', e.target.value)}
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

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>사업자등록번호 *</Label>
                <Input
                  value={formData.businessNumber}
                  onChange={(e) => updateForm('businessNumber', e.target.value.replace(/[^0-9-]/g, ''))}
                  placeholder="123-45-67890"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label>상호 *</Label>
                <Input
                  value={formData.companyName}
                  onChange={(e) => updateForm('companyName', e.target.value)}
                  placeholder="주식회사 ○○○"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label>대표자명 *</Label>
                <Input
                  value={formData.ceoName}
                  onChange={(e) => updateForm('ceoName', e.target.value)}
                  placeholder="홍길동"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label>이메일 *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateForm('email', e.target.value)}
                  placeholder="tax@company.com"
                  className="mt-1"
                  required
                />
              </div>
            </div>

            <div>
              <Label>사업장 주소 *</Label>
              <Input
                value={formData.businessAddress}
                onChange={(e) => updateForm('businessAddress', e.target.value)}
                placeholder="서울시 강남구 ..."
                className="mt-1"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>업태</Label>
                <Input
                  value={formData.businessType}
                  onChange={(e) => updateForm('businessType', e.target.value)}
                  placeholder="도소매"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>종목</Label>
                <Input
                  value={formData.businessCategory}
                  onChange={(e) => updateForm('businessCategory', e.target.value)}
                  placeholder="전자상거래"
                  className="mt-1"
                />
              </div>
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

      {/* 세금계산서 목록 */}
      {invoices.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">발급된 세금계산서가 없습니다.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const statusInfo = statusLabels[invoice.status] || statusLabels.pending;
            return (
              <Card key={invoice.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{invoice.orderNumber}</span>
                      <Badge variant={statusInfo.variant} className="text-xs">
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <p className="font-semibold">{invoice.companyName}</p>
                    <div className="mt-1 text-sm text-gray-600">
                      <p>공급가액: {formatCurrency(invoice.amount)} / 부가세: {formatCurrency(invoice.vat)}</p>
                      <p className="font-bold">합계: {formatCurrency(invoice.totalAmount)}</p>
                    </div>
                    <div className="mt-1 flex gap-3 text-xs text-gray-500">
                      <span>사업자번호: {invoice.businessNumber}</span>
                      <span>대표: {invoice.ceoName}</span>
                    </div>
                    {invoice.approvalNumber && (
                      <p className="mt-1 text-xs text-gray-400">
                        승인번호: {invoice.approvalNumber}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>{format(new Date(invoice.createdAt), 'yyyy.MM.dd')}</p>
                    {invoice.issuedAt && (
                      <p className="text-green-600">
                        발급일: {format(new Date(invoice.issuedAt), 'yyyy.MM.dd')}
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
