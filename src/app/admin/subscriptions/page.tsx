import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { format } from 'date-fns';

interface Subscription {
  id: string;
  memberName: string;
  productName: string;
  cycle: string;
  nextDeliveryDate: string;
  status: string;
}

const statusOptions = [
  { value: 'active', label: '활성' },
  { value: 'paused', label: '일시정지' },
  { value: 'cancelled', label: '취소' },
];

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  paused: 'secondary',
  cancelled: 'destructive',
};

const cycleLabels: Record<string, string> = {
  weekly: '매주',
  biweekly: '격주',
  monthly: '매월',
};

export default function AdminSubscriptionsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadSubscriptions();
    }
  }, [user, authLoading, navigate]);

  async function loadSubscriptions() {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/subscriptions');
      const data = await response.json();
      if (data.success) {
        setSubscriptions(data.data || []);
      } else {
        setError(data.error || '정기배송 목록을 불러오지 못했습니다.');
      }
    } catch {
      setError('정기배송 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(subscriptionId: string, newStatus: string) {
    try {
      const response = await fetch(`/api/admin/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      await loadSubscriptions();
    } catch (err) {
      alert(err instanceof Error ? err.message : '상태 변경 중 오류가 발생했습니다.');
    }
  }

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-3xl font-bold">정기배송 관리</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-500">로딩 중...</div>
      ) : subscriptions.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">정기배송 내역이 없습니다.</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">회원명</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">상품명</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">주기</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">다음 배송일</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">상태</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">상태 변경</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{sub.memberName}</td>
                    <td className="px-4 py-3 text-gray-700">{sub.productName}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {cycleLabels[sub.cycle] || sub.cycle}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {sub.nextDeliveryDate
                        ? format(new Date(sub.nextDeliveryDate), 'yyyy.MM.dd')
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariants[sub.status] || 'outline'}>
                        {statusOptions.find((s) => s.value === sub.status)?.label || sub.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Select
                        value={sub.status}
                        onValueChange={(value) => handleStatusChange(sub.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
