/**
 * SimpleHeader - 심플 헤더
 * 로고 + 메뉴 + 검색 + 장바구니 기본 구성
 */

import { Link } from 'react-router-dom';
import { ShoppingCart, User, Menu } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { useAuth } from '@/hooks/useAuth';
import { useMenuItems } from '@/hooks/useMenuItems';

interface Props {
  logo?: string;
  siteName?: string;
}

export default function SimpleHeader({ logo, siteName = 'Freecart' }: Props) {
  const itemCount = useCartStore((state) => state.getItemCount());
  const { user } = useAuth();
  const { items } = useMenuItems();

  return (
    <header className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* 로고 */}
          <Link to="/" className="flex items-center gap-2">
            {logo ? (
              <img src={logo} alt={siteName} className="h-8" />
            ) : (
              <span className="text-xl font-bold text-gray-900">{siteName}</span>
            )}
          </Link>

          {/* 메뉴 (데스크톱) */}
          <nav className="hidden md:flex items-center gap-8">
            {items.map((item) => (
              <Link
                key={item.id}
                to={item.url}
                className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* 우측 아이콘 */}
          <div className="flex items-center gap-4">
            <Link to={user ? '/mypage' : '/auth/login'} className="p-2 hover:bg-gray-100 rounded-full">
              <User className="h-5 w-5 text-gray-600" />
            </Link>

            <Link to="/cart" className="p-2 hover:bg-gray-100 rounded-full relative">
              <ShoppingCart className="h-5 w-5 text-gray-600" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            {/* 모바일 메뉴 버튼 */}
            <button className="md:hidden p-2 hover:bg-gray-100 rounded-full">
              <Menu className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
