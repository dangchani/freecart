import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';

interface Coupon {
  id: string;
  name: string;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  usedCount: number;
  totalQuantity: number | null;
  expiresAt: string | null;
  isActive: boolean;
}

export default function AdminCouponsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadCoupons();
    }
  }, [user, authLoading, navigate]);

  async function loadCoupons() {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/coupons');
      const data = await response.json();

      if (data.success) {
        setCoupons(data.data || []);
      } else {
        setError(data.error || '쿠폰 목록을 불러오지 못했습니다.');
      }
    } catch {
      setError('쿠폰 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(couponId: string, currentActive: boolean) {
    try {
      const response = await fetch(`/api/admin/coupons/${couponId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      await loadCoupons();
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    }
  }

  if (authLoading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">쿠폰 관리</h1>
        <Link to="/admin/coupons/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            쿠폰 생성
          </Button>
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-500">로딩 중...</div>
      ) : coupons.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="mb-4 text-gray-500">등록된 쿠폰이 없습니다.</p>
          <Link to="/admin/coupons/new">
            <Button>첫 쿠폰 생성하기</Button>
          </Link>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">이름</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">코드</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">할인</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">사용/총량</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">만료일</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">상태</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{coupon.name}</td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs">
                        {coupon.code}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      {coupon.discountType === 'percent'
                        ? `${coupon.discountValue}%`
                        : formatCurrency(coupon.discountValue)}
                    </td>
                    <td className="px-4 py-3">
                      {coupon.usedCount} / {coupon.totalQuantity ?? '∞'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {coupon.expiresAt
                        ? format(new Date(coupon.expiresAt), 'yyyy.MM.dd')
                        : '무제한'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={coupon.isActive ? 'default' : 'secondary'}>
                        {coupon.isActive ? '활성' : '비활성'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleActive(coupon.id, coupon.isActive)}
                      >
                        {coupon.isActive ? '비활성화' : '활성화'}
                      </Button>
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
