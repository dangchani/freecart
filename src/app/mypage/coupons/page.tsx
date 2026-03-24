import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tag, Ticket } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

type FilterType = 'available' | 'used' | 'expired';

interface Coupon {
  id: string;
  code: string;
  name: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  expiresAt: string;
  usedAt?: string;
  status: 'available' | 'used' | 'expired';
}

const filterLabels: Record<FilterType, string> = {
  available: '사용가능',
  used: '사용완료',
  expired: '기간만료',
};

export default function CouponsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('available');
  const [couponCode, setCouponCode] = useState('');
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      fetchCoupons();
    }
  }, [user, authLoading, filter, navigate]);

  async function fetchCoupons() {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/me/coupons?status=${filter}`);
      const json = await res.json();
      if (json.success) setCoupons(json.data || []);
    } catch (err) {
      console.error('쿠폰 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterCoupon() {
    if (!couponCode.trim()) {
      setMessage({ type: 'error', text: '쿠폰 코드를 입력해주세요.' });
      return;
    }
    setRegistering(true);
    setMessage(null);
    try {
      const res = await fetch('/api/users/me/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: '쿠폰이 등록되었습니다.' });
        setCouponCode('');
        fetchCoupons();
      } else {
        setMessage({ type: 'error', text: json.error || '쿠폰 등록에 실패했습니다.' });
      }
    } catch (err) {
      console.error('쿠폰 등록 실패:', err);
      setMessage({ type: 'error', text: '쿠폰 등록 중 오류가 발생했습니다.' });
    } finally {
      setRegistering(false);
    }
  }

  function getDiscountText(coupon: Coupon) {
    if (coupon.discountType === 'percent') {
      const text = `${coupon.discountValue}% 할인`;
      if (coupon.maxDiscountAmount) {
        return `${text} (최대 ${formatCurrency(coupon.maxDiscountAmount)})`;
      }
      return text;
    }
    return `${formatCurrency(coupon.discountValue)} 할인`;
  }

  if (authLoading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">쿠폰</h1>

      {/* 쿠폰 코드 등록 */}
      <Card className="mb-6 p-4">
        <h2 className="mb-3 font-semibold">쿠폰 코드 등록</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleRegisterCoupon()}
            placeholder="쿠폰 코드를 입력하세요"
            className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button onClick={handleRegisterCoupon} disabled={registering}>
            {registering ? '등록 중...' : '등록하기'}
          </Button>
        </div>
        {message && (
          <p className={`mt-2 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
            {message.text}
          </p>
        )}
      </Card>

      {/* 필터 탭 */}
      <div className="mb-4 flex gap-2">
        {(Object.keys(filterLabels) as FilterType[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {filterLabels[f]}
          </Button>
        ))}
      </div>

      {/* 쿠폰 목록 */}
      {loading ? (
        <div className="p-8 text-center text-gray-500">로딩 중...</div>
      ) : coupons.length === 0 ? (
        <Card className="p-12 text-center">
          <Ticket className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">{filterLabels[filter]} 쿠폰이 없습니다.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {coupons.map((coupon) => {
            const isAvailable = coupon.status === 'available';
            return (
              <Card
                key={coupon.id}
                className={`p-4 ${!isAvailable ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded-full p-2 ${isAvailable ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <Tag className={`h-4 w-4 ${isAvailable ? 'text-blue-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{coupon.name}</h3>
                      <p className="text-lg font-bold text-blue-600">{getDiscountText(coupon)}</p>
                      {coupon.minOrderAmount && (
                        <p className="text-xs text-gray-500">
                          {formatCurrency(coupon.minOrderAmount)} 이상 주문 시 사용 가능
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">코드: {coupon.code}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={isAvailable ? 'default' : 'secondary'}
                      className="mb-2"
                    >
                      {filterLabels[coupon.status]}
                    </Badge>
                    <p className="text-xs text-gray-500">
                      {coupon.usedAt
                        ? `사용일: ${format(new Date(coupon.usedAt), 'yyyy.MM.dd')}`
                        : `만료일: ${format(new Date(coupon.expiresAt), 'yyyy.MM.dd')}`}
                    </p>
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
