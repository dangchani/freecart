import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

interface Subscription {
  id: string;
  productId: string;
  productName: string;
  productThumbnail?: string;
  quantity: number;
  price: number;
  cycle: 'weekly' | 'biweekly' | 'monthly';
  nextDeliveryDate: string;
  status: 'active' | 'paused' | 'cancelled';
  createdAt: string;
}

const cycleLabels: Record<string, string> = {
  weekly: '매주',
  biweekly: '격주',
  monthly: '매월',
};

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: '구독중', className: 'bg-green-100 text-green-700' },
  paused: { label: '일시정지', className: 'bg-yellow-100 text-yellow-700' },
  cancelled: { label: '취소됨', className: 'bg-gray-100 text-gray-500' },
};

export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      fetchSubscriptions();
    }
  }, [user, authLoading, navigate]);

  async function fetchSubscriptions() {
    try {
      const res = await fetch('/api/users/me/subscriptions');
      const json = await res.json();
      if (json.success) setSubscriptions(json.data || []);
    } catch (err) {
      console.error('정기배송 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, action: 'pause' | 'resume' | 'cancel') {
    const confirmMessages: Record<string, string> = {
      pause: '정기배송을 일시정지하시겠습니까?',
      resume: '정기배송을 재개하시겠습니까?',
      cancel: '정기배송을 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
    };
    if (!confirm(confirmMessages[action])) return;

    setActionLoading(id);
    try {
      const res = await fetch(`/api/users/me/subscriptions/${id}/${action}`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        await fetchSubscriptions();
      } else {
        alert(json.error || '처리에 실패했습니다.');
      }
    } catch (err) {
      console.error('정기배송 액션 실패:', err);
      alert('처리 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(null);
    }
  }

  if (authLoading || loading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">정기배송</h1>

      {subscriptions.length === 0 ? (
        <Card className="p-12 text-center">
          <RefreshCw className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <p className="mb-4 text-gray-500">정기배송 중인 상품이 없습니다.</p>
          <Button variant="outline" onClick={() => navigate('/products')}>
            상품 둘러보기
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {subscriptions.map((sub) => {
            const statusInfo = statusConfig[sub.status] || statusConfig.cancelled;
            const isLoading = actionLoading === sub.id;

            return (
              <Card key={sub.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="font-semibold">{sub.productName}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>배송 주기: <span className="font-medium">{cycleLabels[sub.cycle] || sub.cycle}</span></p>
                      <p>수량: <span className="font-medium">{sub.quantity}개</span></p>
                      <p>결제금액: <span className="font-medium">{formatCurrency(sub.price * sub.quantity)}</span></p>
                      {sub.status !== 'cancelled' && (
                        <p>
                          다음 배송일:{' '}
                          <span className="font-medium text-blue-600">
                            {format(new Date(sub.nextDeliveryDate), 'yyyy년 MM월 dd일')}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                  {sub.status !== 'cancelled' && (
                    <div className="flex shrink-0 flex-col gap-2">
                      {sub.status === 'active' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(sub.id, 'pause')}
                          disabled={isLoading}
                          className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                        >
                          일시정지
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(sub.id, 'resume')}
                          disabled={isLoading}
                          className="border-green-300 text-green-700 hover:bg-green-50"
                        >
                          재개하기
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAction(sub.id, 'cancel')}
                        disabled={isLoading}
                        className="text-red-500 hover:bg-red-50 hover:text-red-600"
                      >
                        {isLoading ? '처리 중...' : '취소하기'}
                      </Button>
                    </div>
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
