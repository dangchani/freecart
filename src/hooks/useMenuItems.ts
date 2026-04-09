import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';

export interface MenuItem {
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

export function useMenuItems() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const location = useLocation();

  useEffect(() => {
    loadMenus();
    window.addEventListener('freecart:settings-changed', loadMenus);
    return () => window.removeEventListener('freecart:settings-changed', loadMenus);
  }, [location.pathname]);

  async function loadMenus() {
    try {
      const supabase = createClient();

      // menus(순서·숨김 설정) + 최상위 카테고리 + 게시판 병렬 조회
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

      const menus  = menusRes.data  || [];
      const cats   = catsRes.data   || [];
      const boards = boardsRes.data || [];

      // 서브 카테고리 한 번에 조회 (N+1 방지)
      let subCats: { id: string; name: string; slug: string; parent_id: string; sort_order: number }[] = [];
      if (cats.length > 0) {
        const topIds = cats.map((c) => c.id);
        const { data } = await supabase
          .from('product_categories')
          .select('id, name, slug, parent_id, sort_order')
          .eq('is_visible', true)
          .in('parent_id', topIds)
          .order('sort_order');
        subCats = (data || []) as typeof subCats;
      }

      // 서브 카테고리 → 부모별 맵
      const subCatMap = new Map<string, MenuItem[]>();
      for (const sc of subCats) {
        const child: MenuItem = {
          id: `cat_${sc.id}`,
          label: sc.name,
          url: `/categories/${sc.slug}`,
          sortOrder: sc.sort_order,
          children: [],
        };
        const list = subCatMap.get(sc.parent_id) || [];
        list.push(child);
        subCatMap.set(sc.parent_id, list);
      }

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

      // 카테고리: menus에 없으면 기본 표시 / is_visible=false면 숨김
      for (const c of cats) {
        const entry = catMenuMap.get(c.id);
        if (entry && !entry.isVisible) continue;
        result.push({
          id: `cat_${c.id}`,
          label: c.name,
          url: `/categories/${c.slug}`,
          sortOrder: entry?.sortOrder ?? c.sort_order,
          children: subCatMap.get(c.id) || [],
        });
      }

      // 게시판: menus에 없으면 기본 표시 / is_visible=false면 숨김
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
      setItems(result);
    } catch {
      // 메뉴 로드 실패 시 빈 상태 유지
    }
  }

  return { items };
}
