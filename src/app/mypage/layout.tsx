import { useEffect } from 'react';
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  ShoppingBag,
  Star,
  Heart,
  Coins,
  Wallet,
  Tag,
  MapPin,
  Calendar,
  RefreshCw,
  MessageCircle,
  Bell,
  User,
} from 'lucide-react';

const navItems = [
  { href: '/mypage/orders', label: '주문 내역', icon: ShoppingBag },
  { href: '/mypage/reviews', label: '리뷰 관리', icon: Star },
  { href: '/mypage/wishlist', label: '찜 목록', icon: Heart },
  { href: '/mypage/points', label: '포인트', icon: Coins },
  { href: '/mypage/deposits', label: '예치금', icon: Wallet },
  { href: '/mypage/coupons', label: '쿠폰', icon: Tag },
  { href: '/mypage/addresses', label: '배송지 관리', icon: MapPin },
  { href: '/mypage/attendance', label: '출석 체크', icon: Calendar },
  { href: '/mypage/subscriptions', label: '정기배송', icon: RefreshCw },
  { href: '/mypage/inquiries', label: '1:1 문의', icon: MessageCircle },
  { href: '/mypage/notifications', label: '알림 설정', icon: Bell },
  { href: '/mypage/profile', label: '프로필 수정', icon: User },
];

export default function MypageLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container py-8">
      <div className="flex gap-8">
        {/* 사이드바 */}
        <aside className="w-56 shrink-0">
          <div className="mb-4 rounded-lg bg-gray-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.name || user.email}</p>
                <p className="truncate text-xs text-gray-500">{user.email}</p>
              </div>
            </div>
          </div>
          <nav className="space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  to={href}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-50 font-medium text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="min-w-0 flex-1"><Outlet /></main>
      </div>
    </div>
  );
}
