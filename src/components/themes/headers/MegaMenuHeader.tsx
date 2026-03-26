/**
 * MegaMenuHeader - 메가메뉴 헤더
 * 드롭다운 메가메뉴가 있는 헤더
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingCart, User, ChevronDown, Menu, X } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { useAuth } from '@/hooks/useAuth';

interface Category {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
}

interface Props {
  logo?: string;
  siteName?: string;
  categories?: Category[];
}

export default function MegaMenuHeader({ logo, siteName = 'Freecart', categories }: Props) {
  const itemCount = useCartStore((state) => state.getItemCount());
  const { user } = useAuth();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const defaultCategories: Category[] = [
    {
      label: '의류',
      href: '/products?category=clothing',
      children: [
        { label: '상의', href: '/products?category=tops' },
        { label: '하의', href: '/products?category=bottoms' },
        { label: '아우터', href: '/products?category=outer' },
      ],
    },
    {
      label: '가방/잡화',
      href: '/products?category=bags',
      children: [
        { label: '가방', href: '/products?category=bags' },
        { label: '지갑', href: '/products?category=wallets' },
        { label: '악세서리', href: '/products?category=accessories' },
      ],
    },
    {
      label: '신발',
      href: '/products?category=shoes',
      children: [
        { label: '스니커즈', href: '/products?category=sneakers' },
        { label: '구두', href: '/products?category=dress-shoes' },
        { label: '샌들', href: '/products?category=sandals' },
      ],
    },
    { label: '세일', href: '/products?sale=true' },
  ];

  const items = categories || defaultCategories;

  return (
    <header className="bg-white border-b sticky top-0 z-50">
      {/* 상단 바 */}
      <div className="bg-gray-900 text-white text-xs">
        <div className="max-w-7xl mx-auto px-4 py-2 flex justify-between">
          <span>무료배송 5만원 이상 구매 시</span>
          <div className="flex gap-4">
            <Link to="/notices" className="hover:underline">공지사항</Link>
            <Link to="/faqs" className="hover:underline">FAQ</Link>
          </div>
        </div>
      </div>

      {/* 메인 헤더 */}
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

          {/* 검색바 (데스크톱) */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="검색어를 입력하세요"
                className="w-full border rounded-full px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>
          </div>

          {/* 우측 아이콘 */}
          <div className="flex items-center gap-4">
            <Link to={user ? '/mypage' : '/auth/login'} className="hidden md:flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900">
              <User className="h-5 w-5" />
              <span>{user ? '마이페이지' : '로그인'}</span>
            </Link>

            <Link to="/cart" className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900 relative">
              <ShoppingCart className="h-5 w-5" />
              <span className="hidden md:inline">장바구니</span>
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 md:static md:ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {itemCount}
                </span>
              )}
            </Link>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-full"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 메가메뉴 (데스크톱) */}
      <nav className="hidden md:block border-t">
        <div className="max-w-7xl mx-auto px-4">
          <ul className="flex">
            {items.map((item) => (
              <li
                key={item.href}
                className="relative"
                onMouseEnter={() => setOpenMenu(item.label)}
                onMouseLeave={() => setOpenMenu(null)}
              >
                <Link
                  to={item.href}
                  className="flex items-center gap-1 px-4 py-3 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                >
                  {item.label}
                  {item.children && <ChevronDown className="h-4 w-4" />}
                </Link>

                {/* 드롭다운 */}
                {item.children && openMenu === item.label && (
                  <div className="absolute left-0 top-full bg-white border shadow-lg rounded-b-lg min-w-[200px] py-2 z-50">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        to={child.href}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* 모바일 메뉴 */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-white">
          <div className="p-4">
            <input
              type="text"
              placeholder="검색어를 입력하세요"
              className="w-full border rounded-lg px-4 py-2 text-sm"
            />
          </div>
          <nav className="border-t">
            {items.map((item) => (
              <div key={item.href}>
                <Link
                  to={item.href}
                  className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
                {item.children && (
                  <div className="bg-gray-50">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        to={child.href}
                        className="block px-8 py-2 text-sm text-gray-600 hover:text-blue-600"
                        onClick={() => setMobileOpen(false)}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
