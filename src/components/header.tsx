import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { ShoppingCart, User, Menu, Search, X, Shield, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/cart';
import { useAuth } from '@/hooks/useAuth';
import { getSetting } from '@/services/settings';
import { createClient } from '@/lib/supabase/client';

interface MenuItem {
  id: string;
  label: string;
  url: string;
  sortOrder: number;
  children: MenuItem[];
}

const SYSTEM_URL_MAP: Record<string, string> = {
  notice:      '/notices',
  faq:         '/faq',
  inquiry:     '/inquiry',
  product_qna: '/product-qna',
  review:      '/reviews',
};

function DesktopMenuItem({ item }: { item: MenuItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (item.children.length === 0) {
    return (
      <Link
        to={item.url}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
      >
        {item.label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 min-w-[160px] rounded-lg border bg-white shadow-lg z-50 py-1">
          {item.children.map((child) => (
            <Link
              key={child.id}
              to={child.url}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { user, loading, isAdmin } = useAuth();
  const itemCount = useCartStore((state) => state.getItemCount());
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [siteName, setSiteName] = useState('Freecart');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [expandedMobileIds, setExpandedMobileIds] = useState<Set<string>>(new Set());

  const location = useLocation();

  useEffect(() => {
    getSetting('site_name', 'Freecart').then(setSiteName);
  }, []);

  // 라우트 변경 시마다 메뉴 재조회 (어드민에서 변경 후 메인으로 돌아올 때 반영)
  useEffect(() => {
    loadMenus();
  }, [location.pathname]);

  async function loadMenus() {
    try {
      const supabase = createClient();

      // menus(순서·숨김 설정) + categories + boards 병렬 조회
      const [menusRes, catsRes, boardsRes] = await Promise.all([
        supabase
          .from('menus')
          .select('id, menu_type, name, url, sort_order, is_visible, category_id, board_id')
          .eq('position', 'header'),
        supabase
          .from('product_categories')
          .select('id, name, slug, sort_order')
          .eq('is_visible', true)
          .is('parent_id', null)
          .order('sort_order'),
        supabase
          .from('boards')
          .select('id, name, slug, sort_order')
          .eq('is_active', true)
          .order('sort_order'),
      ]);

      const menus   = menusRes.data  || [];
      const cats    = catsRes.data   || [];
      const boards  = boardsRes.data || [];

      // menus 테이블에서 카테고리·게시판의 is_visible / sort_order 맵 구축
      const catMenuMap   = new Map<string, { isVisible: boolean; sortOrder: number }>();
      const boardMenuMap = new Map<string, { isVisible: boolean; sortOrder: number }>();
      const otherItems: MenuItem[] = [];

      for (const m of menus) {
        if (m.menu_type === 'category' && m.category_id) {
          catMenuMap.set(m.category_id, { isVisible: m.is_visible, sortOrder: m.sort_order });
        } else if (m.menu_type === 'board' && m.board_id) {
          boardMenuMap.set(m.board_id, { isVisible: m.is_visible, sortOrder: m.sort_order });
        } else if (m.is_visible) {
          // 시스템·직접링크 항목
          otherItems.push({
            id: m.id,
            label: m.name,
            url: m.url || (SYSTEM_URL_MAP[m.menu_type] ?? '/'),
            sortOrder: m.sort_order,
            children: [],
          });
        }
      }

      const result: MenuItem[] = [...otherItems];

      // 카테고리: menus 에 없으면 기본 표시 / is_visible=false 이면 숨김
      for (const c of cats) {
        const entry = catMenuMap.get(c.id);
        if (entry && !entry.isVisible) continue;
        result.push({
          id: `cat_${c.id}`,
          label: c.name,
          url: `/categories/${c.slug}`,
          sortOrder: entry?.sortOrder ?? c.sort_order,
          children: [],
        });
      }

      // 게시판: menus 에 없으면 기본 표시 / is_visible=false 이면 숨김
      for (const b of boards) {
        const entry = boardMenuMap.get(b.id);
        if (entry && !entry.isVisible) continue;
        result.push({
          id: `board_${b.id}`,
          label: b.name,
          url: `/boards/${b.slug}`,
          sortOrder: entry?.sortOrder ?? b.sort_order,
          children: [],
        });
      }

      result.sort((a, b) => a.sortOrder - b.sortOrder);
      setMenuItems(result);
    } catch {
      // 메뉴 없으면 그냥 빈 상태 유지
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) navigate(`/products/search?q=${encodeURIComponent(q)}`);
  }

  function toggleMobileExpand(id: string) {
    setExpandedMobileIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* 상단 바 */}
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
          <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setMobileSearchOpen(!mobileSearchOpen)} title="검색">
            <Search className="h-5 w-5" />
          </Button>

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

          <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* 데스크탑 네비게이션 바 (메뉴가 있을 때만 표시) */}
      {menuItems.length > 0 && (
        <div className="hidden md:block border-t bg-white">
          <nav className="container flex items-center gap-1 h-10">
            {menuItems.map((item) => (
              <DesktopMenuItem key={item.id} item={item} />
            ))}
          </nav>
        </div>
      )}

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
        <div className="border-t md:hidden bg-white">
          <nav className="container py-3 space-y-0.5">
            {menuItems.map((item) => (
                <div key={item.id}>
                  {item.children.length > 0 ? (
                    <>
                      <button
                        onClick={() => toggleMobileExpand(item.id)}
                        className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium hover:bg-gray-100"
                      >
                        {item.label}
                        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expandedMobileIds.has(item.id) ? 'rotate-180' : ''}`} />
                      </button>
                      {expandedMobileIds.has(item.id) && (
                        <div className="ml-4 border-l pl-3 space-y-0.5 pb-1">
                          {item.children.map((child) => (
                            <Link
                              key={child.id}
                              to={child.url}
                              onClick={() => setMobileMenuOpen(false)}
                              className="block rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
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
                      onClick={() => setMobileMenuOpen(false)}
                      className="block rounded-md px-3 py-2.5 text-sm font-medium hover:bg-gray-100"
                    >
                      {item.label}
                    </Link>
                  )}
                </div>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
