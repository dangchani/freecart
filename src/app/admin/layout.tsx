// joy: 관리자 사이드바 메뉴를 권한 키 기반으로 필터링
import { useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { hasPermissionInList } from '@/lib/permissions';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Package,
  Tag,
  ShoppingCart,
  RefreshCcw,
  Ticket,
  Star,
  HelpCircle,
  FileQuestion,
  MessageSquare,
  BookOpen,
  Bell,
  Image,
  Settings,
  BarChart2,
  Repeat,
  CreditCard,
  Palette,
  Layers,
  ScrollText,
  ShieldBan,
  Eye,
  ShieldCheck,
  KeyRound,
  ToggleRight,
  FormInput,
} from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;      // 필요한 권한 키 (super_admin은 자동 통과)
  superAdminOnly?: boolean; // super_admin 전용 메뉴
};

const navItems: NavItem[] = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard },
  { href: '/admin/users', label: '회원 관리', icon: Users, permission: 'users.read' },
  { href: '/admin/users/pending', label: '가입 승인', icon: UserPlus, permission: 'users.approve' },
  { href: '/admin/products', label: '상품 관리', icon: Package, permission: 'products.read' },
  { href: '/admin/categories', label: '카테고리 관리', icon: Tag, permission: 'products.write' },
  { href: '/admin/orders', label: '주문 관리', icon: ShoppingCart, permission: 'orders.read' },
  { href: '/admin/refunds', label: '환불/반품 관리', icon: RefreshCcw, permission: 'orders.cancel' },
  { href: '/admin/coupons', label: '쿠폰 관리', icon: Ticket, permission: 'coupons.write' },
  { href: '/admin/payment-gateways', label: 'PG사 설정', icon: CreditCard, permission: 'settings.read' },
  { href: '/admin/reviews', label: '리뷰 관리', icon: Star, permission: 'boards.write' },
  { href: '/admin/product-qna', label: '상품 Q&A', icon: HelpCircle, permission: 'boards.write' },
  { href: '/admin/inquiries', label: '1:1 문의', icon: MessageSquare, permission: 'boards.write' },
  { href: '/admin/faqs', label: 'FAQ 관리', icon: FileQuestion, permission: 'boards.write' },
  { href: '/admin/boards', label: '게시판 관리', icon: BookOpen, permission: 'boards.write' },
  { href: '/admin/notices', label: '공지사항', icon: Bell, permission: 'boards.write' },
  { href: '/admin/banners', label: '배너/팝업', icon: Image, permission: 'settings.write' },
  { href: '/admin/themes', label: '테마 관리', icon: Palette, permission: 'settings.write' },
  { href: '/admin/skins', label: '스킨 관리', icon: Layers, permission: 'settings.write' },
  { href: '/admin/settings', label: '설정', icon: Settings, permission: 'settings.read' },
  { href: '/admin/settings/system', label: '시스템 설정', icon: ToggleRight, superAdminOnly: true },
  { href: '/admin/settings/roles', label: '역할 관리', icon: KeyRound, superAdminOnly: true },
  { href: '/admin/settings/signup-fields', label: '회원가입 필드', icon: FormInput, permission: 'signup_fields.manage' },
  { href: '/admin/statistics', label: '통계', icon: BarChart2, permission: 'orders.read' },
  { href: '/admin/subscriptions', label: '정기배송', icon: Repeat, permission: 'orders.read' },
  { href: '/admin/logs', label: '활동 로그', icon: ScrollText, permission: 'settings.read' },
  { href: '/admin/ip-blocks', label: 'IP 차단', icon: ShieldBan, permission: 'settings.write' },
  { href: '/admin/visitors', label: '방문자 통계', icon: Eye, permission: 'settings.read' },
  { href: '/admin/admins', label: '관리자 계정', icon: ShieldCheck, superAdminOnly: true },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, isAdmin, isSuperAdmin, permissions } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth/login');
      return;
    }
    if (!authLoading && user && !isAdmin) {
      navigate('/');
    }
  }, [user, authLoading, isAdmin, navigate]);

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center">로딩 중...</div>;
  }

  const visibleItems = navItems.filter((item) => {
    if (isSuperAdmin) return true;
    if (item.superAdminOnly) return false;
    if (!item.permission) return true;
    return hasPermissionInList(permissions, item.permission);
  });

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
            {visibleItems.map(({ href, label, icon: Icon }) => {
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
