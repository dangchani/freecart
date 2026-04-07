// joy: 관리자 사이드바 — 2뎁스 트리 구조 + 권한 기반 필터링
// 그룹 라벨 클릭 시 첫 하위로 이동, 현재 경로가 속한 그룹만 자동 펼침
import { useEffect, useRef, useState } from 'react';
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
  Truck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type NavItem = {
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  superAdminOnly?: boolean;
  exact?: boolean;       // 정확 일치 매칭 (예: /admin/users)
  children?: NavItem[];
};

// joy: 업무 흐름 기준 그룹화 (기존 아이콘 재사용)
const navItems: NavItem[] = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard, exact: true },

  {
    label: '회원 관리',
    icon: Users,
    permission: 'users.read',
    children: [
      { href: '/admin/users', label: '전체 회원', icon: Users, permission: 'users.read', exact: true },
      { href: '/admin/users/pending', label: '가입 승인', icon: UserPlus, permission: 'users.approve' },
    ],
  },

  {
    label: '상품 관리',
    icon: Package,
    permission: 'products.read',
    children: [
      { href: '/admin/products', label: '상품 목록', icon: Package, permission: 'products.read' },
      { href: '/admin/categories', label: '카테고리', icon: Tag, permission: 'products.write' },
    ],
  },

  {
    label: '주문 관리',
    icon: ShoppingCart,
    permission: 'orders.read',
    children: [
      { href: '/admin/orders', label: '전체 주문', icon: ShoppingCart, permission: 'orders.read', exact: true },
      { href: '/admin/refunds', label: '환불/반품', icon: RefreshCcw, permission: 'orders.cancel' },
      { href: '/admin/subscriptions', label: '정기배송', icon: Repeat, permission: 'orders.read' },
    ],
  },

  {
    label: '고객 소통',
    icon: MessageSquare,
    permission: 'boards.write',
    children: [
      { href: '/admin/boards', label: '게시판', icon: BookOpen, permission: 'boards.write' },
      { href: '/admin/notices', label: '공지사항', icon: Bell, permission: 'boards.write' },
      { href: '/admin/faqs', label: 'FAQ', icon: FileQuestion, permission: 'boards.write' },
      { href: '/admin/inquiries', label: '1:1 문의', icon: MessageSquare, permission: 'boards.write' },
      { href: '/admin/product-qna', label: '상품 Q&A', icon: HelpCircle, permission: 'boards.write' },
      { href: '/admin/reviews', label: '리뷰', icon: Star, permission: 'boards.write' },
    ],
  },

  {
    label: '프로모션',
    icon: Ticket,
    permission: 'coupons.write',
    children: [
      { href: '/admin/coupons', label: '쿠폰', icon: Ticket, permission: 'coupons.write' },
      { href: '/admin/banners', label: '배너/팝업', icon: Image, permission: 'settings.write' },
    ],
  },

  {
    label: '디자인',
    icon: Palette,
    permission: 'settings.write',
    children: [
      { href: '/admin/themes', label: '테마', icon: Palette, permission: 'settings.write' },
      { href: '/admin/skins', label: '스킨', icon: Layers, permission: 'settings.write' },
    ],
  },

  {
    label: '통계',
    icon: BarChart2,
    permission: 'orders.read',
    children: [
      { href: '/admin/statistics', label: '매출 통계', icon: BarChart2, permission: 'orders.read' },
      { href: '/admin/visitors', label: '방문자 통계', icon: Eye, permission: 'settings.read' },
      { href: '/admin/logs', label: '활동 로그', icon: ScrollText, permission: 'settings.read' },
    ],
  },

  {
    label: '설정',
    icon: Settings,
    permission: 'settings.read',
    children: [
      { href: '/admin/settings', label: '기본 설정', icon: Settings, permission: 'settings.read', exact: true },
      { href: '/admin/settings/shipping', label: '배송 설정', icon: Truck, permission: 'settings.write' },
      { href: '/admin/payment-gateways', label: 'PG사 설정', icon: CreditCard, permission: 'settings.read' },
      { href: '/admin/ip-blocks', label: 'IP 차단', icon: ShieldBan, permission: 'settings.write' },
      { href: '/admin/settings/signup-fields', label: '회원가입 필드', icon: FormInput, permission: 'signup_fields.manage' },
      { href: '/admin/settings/system', label: '시스템 설정', icon: ToggleRight, superAdminOnly: true },
      { href: '/admin/settings/roles', label: '역할 관리', icon: KeyRound, superAdminOnly: true },
    ],
  },

  { href: '/admin/admins', label: '관리자 계정', icon: ShieldCheck, superAdminOnly: true },
];

function isItemAllowed(
  item: NavItem,
  isSuperAdmin: boolean,
  permissions: string[]
): boolean {
  if (isSuperAdmin) return true;
  if (item.superAdminOnly) return false;
  if (!item.permission) return true;
  return hasPermissionInList(permissions, item.permission);
}

function filterTree(items: NavItem[], isSuperAdmin: boolean, permissions: string[]): NavItem[] {
  const result: NavItem[] = [];
  for (const item of items) {
    if (item.children) {
      const kids = filterTree(item.children, isSuperAdmin, permissions);
      if (kids.length === 0) continue;
      if (!isItemAllowed(item, isSuperAdmin, permissions)) continue;
      result.push({ ...item, children: kids });
    } else if (isItemAllowed(item, isSuperAdmin, permissions)) {
      result.push(item);
    }
  }
  return result;
}

function isActivePath(pathname: string, item: NavItem): boolean {
  if (!item.href) return false;
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

function isGroupActive(pathname: string, group: NavItem): boolean {
  if (!group.children) return false;
  return group.children.some((c) =>
    c.children ? isGroupActive(pathname, c) : isActivePath(pathname, c)
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, isAdmin, isSuperAdmin, permissions } = useAuth();

  // joy: 사이드바 스크롤 상태 추적 — 위/아래 인디케이터 표시용
  const navRef = useRef<HTMLElement>(null);
  const [showTopIndicator, setShowTopIndicator] = useState(false);
  const [showBottomIndicator, setShowBottomIndicator] = useState(false);

  // joy: 수동으로 토글한 그룹 펼침 상태. 경로 변경 시 현재 그룹은 자동 펼침.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const visibleItems = filterTree(navItems, isSuperAdmin, permissions);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth/login');
      return;
    }
    if (!authLoading && user && !isAdmin) {
      navigate('/');
    }
  }, [user, authLoading, isAdmin, navigate]);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const update = () => {
      setShowTopIndicator(el.scrollTop > 4);
      setShowBottomIndicator(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [visibleItems]);

  // joy: 경로 변경 시 현재 경로가 속한 그룹은 자동으로 펼침 상태에 포함
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      for (const item of visibleItems) {
        if (item.children && isGroupActive(location.pathname, item)) {
          next.add(item.label);
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center">로딩 중...</div>;
  }

  function scrollNav(dir: 'up' | 'down') {
    navRef.current?.scrollBy({ top: dir === 'up' ? -150 : 150, behavior: 'smooth' });
  }

  function toggleGroup(item: NavItem) {
    const key = item.label;
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // 처음 펼치면 첫 하위로 이동
        const firstLeaf = item.children?.find((c) => c.href);
        if (firstLeaf?.href) navigate(firstLeaf.href);
      }
      return next;
    });
  }

  function renderLeaf(item: NavItem, indent: boolean) {
    if (!item.href) return null;
    const Icon = item.icon;
    const active = isActivePath(location.pathname, item);
    return (
      <li key={item.href}>
        <Link
          to={item.href}
          className={`flex items-center gap-3 rounded-md py-2 text-sm transition-colors ${
            indent ? 'pl-9 pr-3' : 'px-3'
          } ${active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {item.label}
        </Link>
      </li>
    );
  }

  function renderGroup(item: NavItem) {
    const Icon = item.icon;
    const active = isGroupActive(location.pathname, item);
    const expanded = openGroups.has(item.label);
    return (
      <li key={item.label}>
        <button
          type="button"
          onClick={() => toggleGroup(item)}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
            active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1">{item.label}</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
          />
        </button>
        {expanded && item.children && (
          <ul className="mt-1 space-y-1">
            {item.children.map((c) => (c.children ? renderGroup(c) : renderLeaf(c, true)))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="relative flex w-64 shrink-0 flex-col bg-white shadow-sm">
        <div className="shrink-0 border-b px-6 py-4">
          <Link to="/admin" className="text-lg font-bold text-gray-900">
            관리자 패널
          </Link>
        </div>
        <div className="relative flex-1 overflow-hidden">
          <nav ref={navRef} className="scrollbar-hide h-full overflow-y-auto p-4">
            <ul className="space-y-1">
              {visibleItems.map((item) => (item.children ? renderGroup(item) : renderLeaf(item, false)))}
            </ul>
          </nav>
          {/* joy: 위쪽 인디케이터 */}
          {showTopIndicator && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex h-8 items-start justify-center bg-gradient-to-b from-white to-transparent">
              <button
                type="button"
                onClick={() => scrollNav('up')}
                className="pointer-events-auto mt-1 rounded-full bg-white p-1 shadow hover:bg-gray-50"
              >
                <ChevronUp className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          )}
          {/* joy: 아래쪽 인디케이터 */}
          {showBottomIndicator && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-8 items-end justify-center bg-gradient-to-t from-white to-transparent">
              <button
                type="button"
                onClick={() => scrollNav('down')}
                className="pointer-events-auto mb-1 rounded-full bg-white p-1 shadow hover:bg-gray-50 animate-bounce"
              >
                <ChevronDown className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          )}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
