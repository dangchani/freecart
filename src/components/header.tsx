import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ShoppingCart, User, Menu, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/cart';
import { useAuth } from '@/hooks/useAuth';

export function Header() {
  const { user } = useAuth();
  const itemCount = useCartStore((state) => state.getItemCount());
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

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
          <span className="text-xl font-bold">Freecart</span>
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
              placeholder="상품을 검색해보세요"
              className="w-full rounded-full border border-gray-300 bg-gray-50 py-2 pl-4 pr-12 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            <button
              type="submit"
              className="absolute right-1 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>

        {/* 네비게이션 (데스크탑) */}
        <nav className="hidden md:flex items-center space-x-5 shrink-0">
          <Link to="/products" className="text-sm font-medium hover:text-primary whitespace-nowrap">상품</Link>
          <Link to="/notices" className="text-sm font-medium hover:text-primary whitespace-nowrap">공지사항</Link>
          <Link to="/faqs" className="text-sm font-medium hover:text-primary whitespace-nowrap">FAQ</Link>
          <Link to="/boards/free" className="text-sm font-medium hover:text-primary whitespace-nowrap">커뮤니티</Link>
        </nav>

        {/* 우측 메뉴 */}
        <div className="flex items-center space-x-2 ml-auto md:ml-0 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileSearchOpen((v) => !v)}
          >
            {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>

          <Link to="/cart">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  {itemCount}
                </span>
              )}
            </Button>
          </Link>

          {user ? (
            <Link to="/mypage">
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </Link>
          ) : (
            <Link to="/auth/login" className="hidden sm:block">
              <Button>로그인</Button>
            </Link>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="md:hidden border-t px-4 py-3 bg-background">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="상품을 검색해보세요"
              autoFocus
              className="flex-1 rounded-full border border-gray-300 bg-gray-50 py-2 px-4 text-sm focus:border-blue-500 focus:outline-none"
            />
            <Button type="submit" size="sm" className="rounded-full px-4">검색</Button>
          </form>
        </div>
      )}

      {mobileMenuOpen && (
        <nav className="md:hidden border-t bg-background">
          <div className="container py-3 flex flex-col space-y-1">
            {[
              { to: '/products', label: '상품' },
              { to: '/notices', label: '공지사항' },
              { to: '/faqs', label: 'FAQ' },
              { to: '/boards/free', label: '커뮤니티' },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="px-3 py-2 text-sm font-medium rounded-md hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {!user && (
              <Link
                to="/auth/login"
                className="px-3 py-2 text-sm font-medium text-blue-600 rounded-md hover:bg-blue-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                로그인
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
