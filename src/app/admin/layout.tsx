import { useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  Package,
  Tag,
  ShoppingCart,
  RefreshCcw,
  Ticket,
  Star,
  HelpCircle,
  MessageSquare,
  BookOpen,
  Bell,
  Image,
  Settings,
  BarChart2,
  Repeat,
} from 'lucide-react';

const navItems = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard },
  { href: '/admin/users', label: '회원 관리', icon: Users },
  { href: '/admin/products', label: '상품 관리', icon: Package },
  { href: '/admin/categories', label: '카테고리 관리', icon: Tag },
  { href: '/admin/orders', label: '주문 관리', icon: ShoppingCart },
  { href: '/admin/refunds', label: '환불/반품 관리', icon: RefreshCcw },
  { href: '/admin/coupons', label: '쿠폰 관리', icon: Ticket },
  { href: '/admin/reviews', label: '리뷰 관리', icon: Star },
  { href: '/admin/product-qna', label: '상품 Q&A', icon: HelpCircle },
  { href: '/admin/inquiries', label: '1:1 문의', icon: MessageSquare },
  { href: '/admin/boards', label: '게시판 관리', icon: BookOpen },
  { href: '/admin/notices', label: '공지사항', icon: Bell },
  { href: '/admin/banners', label: '배너/팝업', icon: Image },
  { href: '/admin/settings', label: '설정', icon: Settings },
  { href: '/admin/statistics', label: '통계', icon: BarChart2 },
  { href: '/admin/subscriptions', label: '정기배송', icon: Repeat },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth/login');
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center">로딩 중...</div>;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 shrink-0 bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <Link to="/admin" className="text-lg font-bold text-gray-900">
            관리자 패널
          </Link>
        </div>
        <nav className="p-4">
          <ul className="space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive =
                href === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    to={href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
