/**
 * MinimalHeader - 미니멀 헤더
 * 로고 + 햄버거 메뉴만
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ShoppingCart, User } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { useAuth } from '@/hooks/useAuth';
import { useMenuItems } from '@/hooks/useMenuItems';

interface Props {
  logo?: string;
  siteName?: string;
}

export default function MinimalHeader({ logo, siteName = 'Freecart' }: Props) {
  const itemCount = useCartStore((state) => state.getItemCount());
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { items } = useMenuItems();

  return (
    <>
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* 햄버거 메뉴 */}
            <button
              onClick={() => setMenuOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <Menu className="h-5 w-5 text-gray-700" />
            </button>

            {/* 로고 (중앙) */}
            <Link to="/" className="absolute left-1/2 -translate-x-1/2">
              {logo ? (
                <img src={logo} alt={siteName} className="h-6" />
              ) : (
                <span className="text-lg font-bold text-gray-900">{siteName}</span>
              )}
            </Link>

            {/* 장바구니 */}
            <Link to="/cart" className="p-2 hover:bg-gray-100 rounded-full relative">
              <ShoppingCart className="h-5 w-5 text-gray-700" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-black text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* 사이드 메뉴 */}
      {menuOpen && (
        <div className="fixed inset-0 z-50">
          {/* 오버레이 */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
          />

          {/* 메뉴 패널 */}
          <div className="absolute left-0 top-0 h-full w-80 max-w-[80vw] bg-white shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <span className="font-bold text-lg">{siteName}</span>
              <button onClick={() => setMenuOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 메뉴 링크 (DB 기반) */}
            <nav className="py-2 overflow-y-auto">
              {items.map((item) => (
                <Link
                  key={item.id}
                  to={item.url}
                  className="block px-6 py-3 text-gray-700 hover:bg-gray-50 font-medium text-sm"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* 하단 */}
            <div className="absolute bottom-0 left-0 right-0 border-t p-4">
              <Link
                to={user ? '/mypage' : '/auth/login'}
                className="flex items-center gap-2 text-gray-700"
                onClick={() => setMenuOpen(false)}
              >
                <User className="h-5 w-5" />
                <span>{user ? (user as any).name || '마이페이지' : '로그인'}</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
