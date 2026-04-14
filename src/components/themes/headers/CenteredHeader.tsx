/**
 * CenteredHeader - 중앙정렬 헤더
 * 로고 중앙, 메뉴 아래 배치
 */

import { Link } from 'react-router-dom';
import { ShoppingCart, User, Heart, Menu } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { useAuth } from '@/hooks/useAuth';
import { useMenuItems } from '@/hooks/useMenuItems';

interface Props {
  logo?: string;
  siteName?: string;
}

export default function CenteredHeader({ logo, siteName = 'Freecart' }: Props) {
  const itemCount = useCartStore((state) => state.getItemCount());
  const { user } = useAuth();
  const { items } = useMenuItems();

  return (
    <header className="bg-white sticky top-0 z-50">
      {/* 상단 유틸리티 바 */}
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-2 flex justify-end text-xs text-gray-500">
          <div className="flex gap-4">
            {user ? (
              <>
                <Link to="/mypage" className="hover:text-gray-900">마이페이지</Link>
                <Link to="/mypage/orders" className="hover:text-gray-900">주문조회</Link>
              </>
            ) : (
              <>
                <Link to="/auth/login" className="hover:text-gray-900">로그인</Link>
                <Link to="/auth/signup" className="hover:text-gray-900">회원가입</Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 로고 영역 */}
      <div className="py-6 border-b">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          {/* 왼쪽 여백 */}
          <div className="w-40" />

          {/* 중앙: 로고 */}
          <Link to="/" className="text-center">
            {logo ? (
              <img src={logo} alt={siteName} className="h-10 mx-auto" />
            ) : (
              <span className="text-2xl font-serif tracking-widest text-gray-900">{siteName}</span>
            )}
          </Link>

          {/* 오른쪽: 아이콘 */}
          <div className="w-40 flex justify-end items-center gap-3">
            <Link to={user ? '/mypage' : '/auth/login'} className="p-2 hover:bg-gray-100 rounded-full">
              <User className="h-5 w-5 text-gray-600" />
            </Link>
            <Link to="/mypage/wishlist" className="p-2 hover:bg-gray-100 rounded-full">
              <Heart className="h-5 w-5 text-gray-600" />
            </Link>
            <Link to="/cart" className="p-2 hover:bg-gray-100 rounded-full relative">
              <ShoppingCart className="h-5 w-5 text-gray-600" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-black text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* 메뉴 (데스크톱) */}
      <nav className="hidden md:block border-b">
        <div className="max-w-7xl mx-auto px-4">
          <ul className="flex justify-center gap-8">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.url}
                  className="block py-4 text-sm font-medium tracking-wide text-gray-700 hover:text-black border-b-2 border-transparent hover:border-black transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* 모바일 메뉴 버튼 */}
      <div className="md:hidden border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <button className="flex items-center gap-2 text-sm text-gray-700">
            <Menu className="h-5 w-5" />
            <span>MENU</span>
          </button>
        </div>
      </div>
    </header>
  );
}
