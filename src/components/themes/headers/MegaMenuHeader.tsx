/**
 * MegaMenuHeader - 메가메뉴 헤더
 * 드롭다운 메가메뉴가 있는 헤더 (DB 메뉴 관리 연동)
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, User, ChevronDown, Menu, X, Shield } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { useAuth } from '@/hooks/useAuth';
import { getSetting } from '@/services/settings';
import { useMenuItems, type MenuItem } from '@/hooks/useMenuItems';

interface Props {
  logo?: string;
  siteName?: string;
}

function DesktopNavItem({ item }: { item: MenuItem }) {
  const [open, setOpen] = useState(false);

  if (item.children.length === 0) {
    return (
      <Link
        to={item.url}
        className="flex items-center px-4 py-3 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-colors"
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link
        to={item.url}
        className="flex items-center gap-1 px-4 py-3 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-colors"
      >
        {item.label}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Link>

      {open && (
        <div className="absolute left-0 top-full bg-white border shadow-lg rounded-b-lg min-w-[180px] py-2 z-50">
          {item.children.map((child) => (
            <Link
              key={child.id}
              to={child.url}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600"
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MegaMenuHeader({ logo, siteName: siteNameProp }: Props) {
  const itemCount = useCartStore((state) => state.getItemCount());
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [openMobile, setOpenMobile] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [siteName, setSiteName] = useState(siteNameProp || 'Freecart');

  const { items } = useMenuItems();

  useEffect(() => {
    if (!siteNameProp) {
      getSetting('site_name', 'Freecart').then(setSiteName);
    }
  }, [siteNameProp]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) navigate(`/products/search?q=${encodeURIComponent(q)}`);
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <header className="bg-white border-b sticky top-0 z-50">
      {/* 상단 알림 바 */}
      <div className="bg-gray-900 text-white text-xs">
        <div className="max-w-7xl mx-auto px-4 py-2 flex justify-between">
          <span>무료배송 5만원 이상 구매 시</span>
          <div className="flex gap-4">
            {user ? (
              <>
                <Link to="/mypage" className="hover:underline">마이페이지</Link>
                <Link to="/mypage/orders" className="hover:underline">주문조회</Link>
              </>
            ) : (
              <>
                <Link to="/auth/login" className="hover:underline">로그인</Link>
                <Link to="/auth/signup" className="hover:underline">회원가입</Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 메인 헤더 */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* 로고 */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            {logo ? (
              <img src={logo} alt={siteName} className="h-8" />
            ) : (
              <span className="text-xl font-bold text-gray-900">{siteName}</span>
            )}
          </Link>

          {/* 검색바 (데스크탑) */}
          <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="상품 검색..."
                className="w-full border rounded-full px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
                <Search className="h-5 w-5 text-gray-400" />
              </button>
            </div>
          </form>

          {/* 우측 아이콘 */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <>
                {isAdmin && (
                  <Link to="/admin" className="hidden md:flex items-center text-gray-700 hover:text-gray-900">
                    <Shield className="h-5 w-5" />
                  </Link>
                )}
                <Link to="/mypage" className="hidden md:flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900">
                  <User className="h-5 w-5" />
                  <span>마이페이지</span>
                </Link>
              </>
            ) : (
              <Link to="/auth/login" className="hidden md:flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900">
                <User className="h-5 w-5" />
                <span>로그인</span>
              </Link>
            )}

            <Link to="/cart" className="relative flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900">
              <ShoppingCart className="h-5 w-5" />
              <span className="hidden md:inline">장바구니</span>
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 md:static md:ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>

            <button
              onClick={() => setOpenMobile(!openMobile)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-full"
            >
              {openMobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* 메가메뉴 네비게이션 (데스크탑) */}
      {items.length > 0 && (
        <nav className="hidden md:block border-t">
          <div className="max-w-7xl mx-auto px-4">
            <ul className="flex">
              {items.map((item) => (
                <li key={item.id}>
                  <DesktopNavItem item={item} />
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}

      {/* 모바일 메뉴 */}
      {openMobile && (
        <div className="md:hidden border-t bg-white">
          {/* 모바일 검색 */}
          <div className="p-4 border-b">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="상품 검색..."
                  className="w-full border rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Search className="h-4 w-4 text-gray-400" />
                </button>
              </div>
            </form>
          </div>

          {/* 모바일 메뉴 목록 */}
          <nav className="py-2">
            {items.map((item) => (
              <div key={item.id}>
                {item.children.length > 0 ? (
                  <>
                    <button
                      onClick={() => toggleExpand(item.id)}
                      className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {item.label}
                      <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expandedIds.has(item.id) ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedIds.has(item.id) && (
                      <div className="bg-gray-50 border-t border-b">
                        {item.children.map((child) => (
                          <Link
                            key={child.id}
                            to={child.url}
                            className="block px-8 py-2.5 text-sm text-gray-600 hover:text-blue-600"
                            onClick={() => setOpenMobile(false)}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    to={item.url}
                    className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={() => setOpenMobile(false)}
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}

            {/* 모바일 사용자 링크 */}
            <div className="border-t mt-2 pt-2">
              {user ? (
                <>
                  {isAdmin && (
                    <Link to="/admin" className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setOpenMobile(false)}>
                      관리자
                    </Link>
                  )}
                  <Link to="/mypage" className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setOpenMobile(false)}>
                    마이페이지
                  </Link>
                </>
              ) : (
                <Link to="/auth/login" className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setOpenMobile(false)}>
                  로그인
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
