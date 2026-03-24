import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
} from 'lucide-react';

interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  totalUsers: number;
  orderStatusCounts: {
    pending: number;
    paid: number;
    preparing: number;
    shipping: number;
    delivered: number;
    cancelled: number;
  };
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

interface LowStockProduct {
  id: string;
  name: string;
  slug: string;
  stock: number;
}

interface DashboardData {
  stats: DashboardStats;
  recentOrders: RecentOrder[];
  lowStockProducts: LowStockProduct[];
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: '결제 대기', variant: 'secondary' },
  paid: { label: '결제 완료', variant: 'default' },
  preparing: { label: '배송 준비중', variant: 'default' },
  shipping: { label: '배송중', variant: 'default' },
  delivered: { label: '배송 완료', variant: 'outline' },
  cancelled: { label: '취소됨', variant: 'destructive' },
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadDashboard();
    }
  }, [user, authLoading, navigate]);

  async function loadDashboard() {
    try {
      const res = await fetch('/api/admin/dashboard');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || '대시보드 데이터를 불러오지 못했습니다.');
      }
    } catch (err) {
      console.error('대시보드 로딩 실패:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return <div className="container py-8 text-center text-gray-500">로딩 중...</div>;
  }

  const stats = data?.stats;
  const recentOrders = data?.recentOrders || [];
  const lowStockProducts = data?.lowStockProducts || [];

  return (
    <div className="container py-8">
      <h1 className="mb-8 text-3xl font-bold">관리자 대시보드</h1>

      {error && (
        <div className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* 주요 통계 */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">오늘 매출</p>
              <p className="text-2xl font-bold">{formatCurrency(stats?.todaySales || 0)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <ShoppingCart className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">오늘 주문</p>
              <p className="text-2xl font-bold">{(stats?.todayOrders || 0).toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">총 회원</p>
              <p className="text-2xl font-bold">{(stats?.totalUsers || 0).toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">처리 대기</p>
              <p className="text-2xl font-bold">
                {((stats?.orderStatusCounts?.pending || 0) + (stats?.orderStatusCounts?.paid || 0)).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* 주문 상태별 현황 */}
      {stats?.orderStatusCounts && (
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">주문 상태 현황</h2>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { key: 'pending', icon: Clock, color: 'text-gray-500', bg: 'bg-gray-50' },
              { key: 'paid', icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
              { key: 'preparing', icon: Package, color: 'text-orange-500', bg: 'bg-orange-50' },
              { key: 'shipping', icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { key: 'delivered', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
              { key: 'cancelled', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
            ].map(({ key, icon: Icon, color, bg }) => {
              const count = stats.orderStatusCounts[key as keyof typeof stats.orderStatusCounts] || 0;
              const label = statusConfig[key]?.label || key;
              return (
                <Card key={key} className={`p-4 ${bg}`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-xs text-gray-600">{label}</span>
                  </div>
                  <p className={`mt-1 text-xl font-bold ${color}`}>{count.toLocaleString()}</p>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 최근 주문 */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">최근 주문</h2>
            <Link to="/admin/orders" className="text-sm text-blue-600 hover:underline">
              전체 보기
            </Link>
          </div>
          <Card>
            {recentOrders.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">최근 주문이 없습니다.</div>
            ) : (
              <div className="divide-y">
                {recentOrders.map((order) => {
                  const statusInfo = statusConfig[order.status] || { label: order.status, variant: 'outline' as const };
                  return (
                    <div key={order.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{order.orderNumber}</p>
                        <p className="text-xs text-gray-500">
                          {order.customerName} · {format(new Date(order.createdAt), 'MM.dd HH:mm')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{formatCurrency(order.totalAmount)}</span>
                        <Badge variant={statusInfo.variant} className="text-xs">
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* 재고 부족 상품 */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">재고 부족 상품</h2>
            <Link to="/admin/products" className="text-sm text-blue-600 hover:underline">
              상품 관리
            </Link>
          </div>
          <Card>
            {lowStockProducts.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">재고 부족 상품이 없습니다.</div>
            ) : (
              <div className="divide-y">
                {lowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <Link
                        to={`/admin/products/${product.id}`}
                        className="text-sm font-medium hover:text-blue-600"
                      >
                        {product.name}
                      </Link>
                    </div>
                    <Badge
                      variant={product.stock === 0 ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {product.stock === 0 ? '품절' : `${product.stock}개`}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* 빠른 메뉴 */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/admin/products', label: '상품 관리', desc: '상품 등록, 수정, 삭제 및 재고 관리' },
          { href: '/admin/orders', label: '주문 관리', desc: '주문 내역 조회 및 배송 상태 관리' },
          { href: '/admin/categories', label: '카테고리 관리', desc: '카테고리 추가, 수정, 삭제' },
          { href: '/admin/boards', label: '게시판 관리', desc: '게시판 및 게시글 관리' },
        ].map(({ href, label, desc }) => (
          <Link key={href} to={href}>
            <Card className="cursor-pointer p-5 transition-shadow hover:shadow-md">
              <h3 className="mb-1 font-semibold">{label}</h3>
              <p className="text-sm text-gray-500">{desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
