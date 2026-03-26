import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';

interface Refund {
  id: string;
  orderNumber: string;
  refundAmount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: '검토중', variant: 'secondary' },
  approved: { label: '승인됨', variant: 'default' },
  rejected: { label: '거부됨', variant: 'destructive' },
};

export default function AdminRefundsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadRefunds();
    }
  }, [user, authLoading, navigate]);

  async function loadRefunds() {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('refunds')
        .select('id, amount, reason, status, created_at, orders(order_number)')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setRefunds(
        (data || []).map((r: any) => ({
          id: r.id,
          orderNumber: r.orders?.order_number || '',
          refundAmount: r.amount,
          reason: r.reason,
          status: r.status,
          createdAt: r.created_at,
        }))
      );
    } catch {
      setError('환불 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(refundId: string, action: 'approve' | 'reject') {
    const actionLabel = action === 'approve' ? '승인' : '거부';
    if (!confirm(`환불 요청을 ${actionLabel}하시겠습니까?`)) return;

    try {
      const supabase = createClient();
      const updateData: Record<string, any> = {
        status: action === 'approve' ? 'approved' : 'rejected',
      };
      if (action === 'approve') {
        updateData.approved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('refunds')
        .update(updateData)
        .eq('id', refundId);

      if (error) throw error;
      await loadRefunds();
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    }
  }

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-3xl font-bold">환불/반품 관리</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-500">로딩 중...</div>
      ) : refunds.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">환불 요청 내역이 없습니다.</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">주문번호</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">환불금액</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">사유</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">상태</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">신청일</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">처리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {refunds.map((refund) => {
                  const statusInfo = statusLabels[refund.status] || { label: refund.status, variant: 'outline' as const };
                  return (
                    <tr key={refund.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{refund.orderNumber}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(refund.refundAmount)}</td>
                      <td className="max-w-xs px-4 py-3 text-gray-600">
                        <span className="line-clamp-2">{refund.reason}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {refund.createdAt ? format(new Date(refund.createdAt), 'yyyy.MM.dd HH:mm') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {refund.status === 'pending' && (
                          <div className="flex justify-center gap-1">
                            <Button size="sm" onClick={() => handleAction(refund.id, 'approve')}>승인</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleAction(refund.id, 'reject')}>거부</Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
