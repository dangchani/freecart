import Link from 'next/link';
import { ShoppingCart, User, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/cart';
import { useAuth } from '@/hooks/useAuth';

export function Header() {
  const { user } = useAuth();
  const itemCount = useCartStore((state) => state.getItemCount());

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* 로고 */}
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold">Freecart</span>
        </Link>

        {/* 네비게이션 */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link href="/products" className="text-sm font-medium hover:text-primary">
            상품
          </Link>
          <Link href="/categories" className="text-sm font-medium hover:text-primary">
            카테고리
          </Link>
          <Link href="/boards/notice" className="text-sm font-medium hover:text-primary">
            공지사항
          </Link>
          <Link href="/boards/free" className="text-sm font-medium hover:text-primary">
            커뮤니티
          </Link>
        </nav>

        {/* 우측 메뉴 */}
        <div className="flex items-center space-x-4">
          {/* 장바구니 */}
          <Link href="/cart">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  {itemCount}
                </span>
              )}
            </Button>
          </Link>

          {/* 사용자 메뉴 */}
          {user ? (
            <Link href="/mypage">
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </Link>
          ) : (
            <Link href="/auth/login">
              <Button>로그인</Button>
            </Link>
          )}

          {/* 모바일 메뉴 */}
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
