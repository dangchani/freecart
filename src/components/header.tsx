import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ShoppingCart, User, Menu, Search, X, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/cart';
import { useAuth } from '@/hooks/useAuth';
import { getSetting } from '@/services/settings';

export function Header() {
  const { user, loading, isAdmin } = useAuth();
  const itemCount = useCartStore((state) => state.getItemCount());
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [siteName, setSiteName] = useState('Freecart');

  useEffect(() => {
    getSetting('site_name', 'Freecart').then(setSiteName);
  }, []);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      navigate(`/products/search?q=${encodeURIComponent(q)}`);
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center gap-4">
        {/* 로고 */}
        <Link to="/" className="flex items-center space-x-2 shrink-0">
          <span className="text-xl font-bold">{siteName}</span>
        </Link>

        {/* 검색바 (데스크탑) */}
        <form
          onSubmit={handleSearchSubmit}
          className="hidden md:flex flex-1 max-w-xl mx-auto items-center"
        >
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="상품 검색..."
              className="w-full rounded-lg border bg-gray-50 px-4 py-2 pr-10 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
              <Search className="h-4 w-4" />
            </button>
          </div>
        </form>

        {/* 우측 메뉴 */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {/* 모바일 검색 토글 */}
          <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setMobileSearchOpen(!mobileSearchOpen)} title="검색">
            <Search className="h-5 w-5" />
          </Button>

          {/* 장바구니 */}
          <Link to="/cart" className="relative">
            <Button variant="ghost" size="sm">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Button>
          </Link>

          {/* 사용자 메뉴 */}
          {loading ? null : user ? (
            <div className="flex items-center gap-1">
              {isAdmin && (
                <Link to="/admin">
                  <Button variant="ghost" size="sm" title="관리자">
                    <Shield className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              <Link to="/mypage">
                <Button variant="ghost" size="sm">
                  <User className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          ) : (
            <Link to="/auth/login">
              <Button size="sm">로그인</Button>
            </Link>
          )}

          {/* 모바일 메뉴 토글 */}
          <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* 모바일 검색 */}
      {mobileSearchOpen && (
        <div className="border-t px-4 py-3 md:hidden">
          <form onSubmit={handleSearchSubmit}>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="상품 검색..."
                className="w-full rounded-lg border bg-gray-50 px-4 py-2 pr-10 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                <Search className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 모바일 메뉴 */}
      {mobileMenuOpen && (
        <div className="border-t md:hidden">
          <nav className="container space-y-1 py-4">
            <Link to="/products" className="block rounded-md px-3 py-2 text-sm hover:bg-gray-100" onClick={() => setMobileMenuOpen(false)}>
              전체 상품
            </Link>
            <Link to="/boards" className="block rounded-md px-3 py-2 text-sm hover:bg-gray-100" onClick={() => setMobileMenuOpen(false)}>
              커뮤니티
            </Link>
            <Link to="/notices" className="block rounded-md px-3 py-2 text-sm hover:bg-gray-100" onClick={() => setMobileMenuOpen(false)}>
              공지사항
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
