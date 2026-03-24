import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';

type Period = 'daily' | 'weekly' | 'monthly';

interface SalesData {
  period: string;
  revenue: number;
  orderCount: number;
}

interface TopProduct {
  id: string;
  name: string;
  soldCount: number;
  revenue: number;
}

interface UserLevel {
  level: string;
  count: number;
}

const periodLabels: Record<Period, string> = {
  daily: '일별',
  weekly: '주별',
  monthly: '월별',
};

const levelLabels: Record<string, string> = {
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  vip: 'VIP',
};

export default function AdminStatisticsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [period, setPeriod] = useState<Period>('daily');
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [userLevels, setUserLevels] = useState<UserLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadAll();
    }
  }, [user, authLoading, period, navigate]);

  async function loadAll() {
    try {
      setLoading(true);
      const [salesRes, productsRes, usersRes] = await Promise.all([
        fetch(`/api/admin/statistics/sales?period=${period}`),
        fetch('/api/admin/statistics/products'),
        fetch('/api/admin/statistics/users'),
      ]);

      const [salesJson, productsJson, usersJson] = await Promise.all([
        salesRes.json(),
        productsRes.json(),
        usersRes.json(),
      ]);

      if (salesJson.success) setSalesData(salesJson.data || []);
      if (productsJson.success) setTopProducts(productsJson.data || []);
      if (usersJson.success) setUserLevels(usersJson.data || []);
    } catch {
      setError('통계 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  const maxRevenue = Math.max(...salesData.map((d) => d.revenue), 1);
  const totalUsers = userLevels.reduce((sum, l) => sum + l.count, 0);

  if (authLoading || loading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-3xl font-bold">통계</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {/* 매출 통계 */}
      <Card className="mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">매출 통계</h2>
          <div className="flex gap-2">
            {(Object.keys(periodLabels) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'border text-gray-700 hover:bg-gray-50'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        </div>

        {salesData.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">매출 데이터가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {salesData.map((item) => (
              <div key={item.period}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-gray-700">{item.period}</span>
                  <span className="text-gray-600">
                    {formatCurrency(item.revenue)} ({item.orderCount}건)
                  </span>
                </div>
                <div className="h-5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${(item.revenue / maxRevenue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 인기 상품 TOP 10 */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">인기 상품 TOP 10</h2>
          {topProducts.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">데이터가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {topProducts.slice(0, 10).map((product, idx) => (
                <div key={product.id} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-center font-bold text-gray-400">{idx + 1}</span>
                  <span className="flex-1 truncate font-medium">{product.name}</span>
                  <span className="text-gray-600">{product.soldCount}개</span>
                  <span className="text-gray-500">{formatCurrency(product.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 회원 등급 분포 */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">회원 등급 분포</h2>
          {userLevels.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">데이터가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {userLevels.map((level) => (
                <div key={level.level}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{levelLabels[level.level] || level.level}</span>
                    <span className="text-gray-600">
                      {level.count}명 (
                      {totalUsers > 0
                        ? Math.round((level.count / totalUsers) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                  <div className="h-4 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-purple-500 transition-all duration-500"
                      style={{
                        width: `${totalUsers > 0 ? (level.count / totalUsers) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              <p className="mt-2 text-sm text-gray-500">총 회원: {totalUsers}명</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
