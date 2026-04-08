import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, Eye, EyeOff, X, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { MenuType } from '@/types';

// ─── 타입 ───────────────────────────────────────────────────────────────────

interface FlatItem {
  id: string;
  menuType: MenuType;
  displayName: string;
  displayUrl: string;
  isVisible: boolean;
  isSystem: boolean;
  sortOrder: number;
  categoryId?: string; // 중복 제거용
  boardId?: string;    // 중복 제거용
}

interface CategoryOption { id: string; name: string; slug: string; }
interface BoardOption    { id: string; name: string; slug: string; }

// ─── 헬퍼 ───────────────────────────────────────────────────────────────────

const SYSTEM_URL_MAP: Partial<Record<MenuType, string>> = {
  notice:      '/notices',
  faq:         '/faq',
  inquiry:     '/inquiry',
  product_qna: '/product-qna',
  review:      '/reviews',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveItem(m: any): FlatItem {
  const type = m.menu_type as MenuType;
  let displayName: string = m.name;
  let displayUrl: string  = m.url || '/';

  const cat   = Array.isArray(m.product_categories) ? m.product_categories[0] : m.product_categories;
  const board = Array.isArray(m.boards)             ? m.boards[0]             : m.boards;

  if (type === 'category' && cat) {
    displayName = cat.name;
    displayUrl  = `/categories/${cat.slug}`;
  } else if (type === 'board' && board) {
    displayName = board.name;
    displayUrl  = `/boards/${board.slug}`;
  } else if (SYSTEM_URL_MAP[type]) {
    displayUrl = SYSTEM_URL_MAP[type]!;
  }

  return {
    id: m.id,
    menuType: type,
    displayName,
    displayUrl,
    isVisible: m.is_visible,
    isSystem: m.is_system,
    sortOrder: m.sort_order,
    categoryId: m.category_id ?? undefined,
    boardId: m.board_id ?? undefined,
  };
}

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  category:    { label: '카테고리', className: 'bg-blue-50 text-blue-600' },
  board:       { label: '게시판',   className: 'bg-purple-50 text-purple-600' },
  notice:      { label: '시스템',   className: 'bg-gray-100 text-gray-500' },
  faq:         { label: '시스템',   className: 'bg-gray-100 text-gray-500' },
  inquiry:     { label: '시스템',   className: 'bg-gray-100 text-gray-500' },
  product_qna: { label: '시스템',   className: 'bg-gray-100 text-gray-500' },
  review:      { label: '시스템',   className: 'bg-gray-100 text-gray-500' },
  link:        { label: '링크',     className: 'bg-green-50 text-green-600' },
};

// ─── SortableRow ─────────────────────────────────────────────────────────────

function SortableRow({
  item,
  onDelete,
  onToggle,
  isGhost,
}: {
  item: FlatItem;
  onDelete: (id: string) => void;
  onToggle: (id: string, val: boolean) => void;
  isGhost?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isSorting } =
    useSortable({ id: item.id });

  const badge = TYPE_BADGE[item.menuType] ?? TYPE_BADGE.link;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition: isSorting ? transition : undefined }}
      className={isGhost ? 'opacity-40' : ''}
    >
      <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors">
        {/* 드래그 핸들 */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-gray-300 hover:text-gray-500 active:cursor-grabbing shrink-0"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* 이름 */}
        <span className={`flex-1 font-medium truncate ${!item.isVisible ? 'text-gray-400' : 'text-gray-800'}`}>
          {item.displayName}
        </span>

        {/* URL */}
        <span className="hidden sm:block text-xs text-gray-400 max-w-[200px] truncate shrink-0">
          {item.displayUrl}
        </span>

        {/* 타입 뱃지 */}
        <span className={`hidden sm:block text-[10px] px-1.5 py-0.5 rounded shrink-0 ${badge.className}`}>
          {badge.label}
        </span>

        {/* 액션 */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => onToggle(item.id, !item.isVisible)}
            className={`p-1.5 rounded hover:bg-gray-100 ${item.isVisible ? 'text-green-500' : 'text-gray-300'}`}
            title={item.isVisible ? '숨기기' : '보이기'}
          >
            {item.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>

          {item.menuType === 'link' && (
            <button
              onClick={() => onDelete(item.id)}
              className="p-1.5 rounded text-red-400 hover:bg-red-50"
              title="삭제"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function AdminMenusPage() {
  const [items, setItems]         = useState<FlatItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [boards, setBoards]       = useState<BoardOption[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState('');
  const [activeId, setActiveId]   = useState<string | null>(null);

  // 폼
  const [showForm, setShowForm]       = useState(false);
  const [formType, setFormType]       = useState<'category' | 'board' | 'link'>('category');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formBoardId, setFormBoardId]       = useState('');
  const [formName, setFormName]       = useState('');
  const [formUrl, setFormUrl]         = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const loadingRef = useRef(false); // StrictMode 이중 실행 방지

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const supabase = createClient();

      // 카테고리·게시판 전체 + 현재 menus 항목 병렬 조회
      const [catsRes, boardsRes, menusRes] = await Promise.all([
        supabase
          .from('product_categories')
          .select('id, name, slug, sort_order')
          .eq('is_visible', true)
          .is('parent_id', null)
          .order('sort_order', { ascending: true }),
        supabase
          .from('boards')
          .select('id, name, slug, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
        supabase
          .from('menus')
          .select('id, menu_type, category_id, board_id')
          .eq('position', 'header'),
      ]);

      if (menusRes.error) throw menusRes.error;

      const existingCatIds  = new Set(menusRes.data?.filter(m => m.menu_type === 'category').map(m => m.category_id));
      const existingBoardIds = new Set(menusRes.data?.filter(m => m.menu_type === 'board').map(m => m.board_id));

      // menus 테이블에 없는 카테고리·게시판 자동 삽입
      const newCatInserts = (catsRes.data || [])
        .filter(c => !existingCatIds.has(c.id))
        .map((c, i) => ({
          menu_type: 'category',
          name: c.name,
          category_id: c.id,
          position: 'header',
          is_system: false,
          is_visible: true,
          sort_order: i,
        }));

      const newBoardInserts = (boardsRes.data || [])
        .filter(b => !existingBoardIds.has(b.id))
        .map((b, i) => ({
          menu_type: 'board',
          name: b.name,
          board_id: b.id,
          position: 'header',
          is_system: false,
          is_visible: true,
          sort_order: 50 + i,
        }));

      if (newCatInserts.length > 0) {
        const { error: catInsertErr } = await supabase.from('menus').insert(newCatInserts);
        if (catInsertErr) console.error('[menus] 카테고리 자동 삽입 실패:', catInsertErr);
      }
      if (newBoardInserts.length > 0) {
        const { error: boardInsertErr } = await supabase.from('menus').insert(newBoardInserts);
        if (boardInsertErr) console.error('[menus] 게시판 자동 삽입 실패:', boardInsertErr);
      }

      // 전체 menus 재조회 (category_id, board_id 포함 — 중복 제거에 사용)
      const { data, error } = await supabase
        .from('menus')
        .select('id, menu_type, name, url, is_visible, is_system, sort_order, category_id, board_id, product_categories(name, slug), boards(name, slug)')
        .eq('position', 'header')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      // category_id / board_id 기준으로 중복 제거 (DB에 중복 행이 있어도 하나만 표시)
      const seenCatIds   = new Set<string>();
      const seenBoardIds = new Set<string>();
      const deduped = (data || []).filter((m) => {
        if (m.menu_type === 'category' && m.category_id) {
          if (seenCatIds.has(m.category_id)) return false;
          seenCatIds.add(m.category_id);
        } else if (m.menu_type === 'board' && m.board_id) {
          if (seenBoardIds.has(m.board_id)) return false;
          seenBoardIds.add(m.board_id);
        }
        return true;
      });

      setItems(deduped.map(resolveItem));
      setCategories(catsRes.data || []);
      setBoards(boardsRes.data || []);
    } catch {
      showToast('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }

  // ── 드래그 ──────────────────────────────────────────────────────────────

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id);
      const newIdx = prev.findIndex((i) => i.id === over.id);
      const reordered = arrayMove(prev, oldIdx, newIdx);
      saveOrder(reordered);
      return reordered;
    });
  }

  async function saveOrder(ordered: FlatItem[]) {
    setSaving(true);
    try {
      const supabase = createClient();
      for (const [idx, item] of ordered.entries()) {
        await supabase.from('menus').update({ sort_order: idx }).eq('id', item.id);
      }
    } catch {
      showToast('순서 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  // ── 직접 링크 추가 ───────────────────────────────────────────────────────

  function openForm() {
    setFormName('');
    setFormUrl('');
    setShowForm(true);
  }

  async function handleAdd() {
    if (!formName.trim() || !formUrl.trim()) return;
    try {
      setSaving(true);
      const supabase = createClient();
      await supabase.from('menus').insert({
        menu_type: 'link',
        name: formName.trim(),
        url: formUrl.trim(),
        position: 'header',
        is_system: false,
        is_visible: true,
        sort_order: items.length,
      });
      setShowForm(false);
      await loadData();
      showToast('추가되었습니다.');
    } catch {
      showToast('추가에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  // ── 삭제 ────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    const item = items.find((i) => i.id === id);
    if (item?.isSystem) return;
    if (!confirm(`"${item?.displayName}" 메뉴를 삭제하시겠습니까?`)) return;
    try {
      const supabase = createClient();
      await supabase.from('menus').delete().eq('id', id);
      await loadData();
      showToast('삭제되었습니다.');
    } catch {
      showToast('삭제에 실패했습니다.');
    }
  }

  // ── 토글 ────────────────────────────────────────────────────────────────

  async function handleToggle(id: string, val: boolean) {
    try {
      const supabase = createClient();
      await supabase.from('menus').update({ is_visible: val }).eq('id', id);
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isVisible: val } : i)));
    } catch {
      showToast('상태 변경에 실패했습니다.');
    }
  }

  // ── 폼 검증 ─────────────────────────────────────────────────────────────

  function isAddable(): boolean {
    if (formType === 'category') return !!formCategoryId;
    if (formType === 'board')    return !!formBoardId;
    return !!formName.trim() && !!formUrl.trim();
  }

  // ── 이미 추가된 category/board ID 목록 ──────────────────────────────────

  const usedCategoryIds = new Set(items.filter((i) => i.menuType === 'category').map((i) => (i as any).categoryId));
  const usedBoardIds    = new Set(items.filter((i) => i.menuType === 'board').map((i) => (i as any).boardId));

  const draggingItem = activeId ? items.find((i) => i.id === activeId) : null;
  const dragBadge = draggingItem ? (TYPE_BADGE[draggingItem.menuType] ?? TYPE_BADGE.link) : null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* 토스트 */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">메뉴 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            드래그로 순서 변경 · 눈 아이콘으로 표시/숨김
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-gray-400 animate-pulse">저장 중...</span>}
          <button
            onClick={openForm}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            메뉴 추가
          </button>
        </div>
      </div>

      {/* 추가 폼 */}
      {showForm && (
        <div className="mb-5 border rounded-xl p-5 bg-blue-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">메뉴 항목 추가</h3>
            <button onClick={() => setShowForm(false)}>
              <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>

          {/* 타입 선택 */}
          <div className="flex gap-3 mb-4">
            {(['category', 'board', 'link'] as const).map((t) => (
              <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="formType"
                  value={t}
                  checked={formType === t}
                  onChange={() => setFormType(t)}
                  className="text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">
                  {t === 'category' ? '카테고리' : t === 'board' ? '게시판' : '직접 링크'}
                </span>
              </label>
            ))}
          </div>

          {/* 타입별 입력 */}
          {formType === 'category' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">카테고리 선택</label>
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">선택하세요</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id} disabled={usedCategoryIds.has(c.id)}>
                    {c.name}{usedCategoryIds.has(c.id) ? ' (이미 추가됨)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formType === 'board' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">게시판 선택</label>
              <select
                value={formBoardId}
                onChange={(e) => setFormBoardId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">선택하세요</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id} disabled={usedBoardIds.has(b.id)}>
                    {b.name}{usedBoardIds.has(b.id) ? ' (이미 추가됨)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formType === 'link' && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">메뉴명 *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="예: 이벤트"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">링크 URL *</label>
                <input
                  type="text"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="/events"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end mt-4">
            <button
              onClick={() => setShowForm(false)}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || !isAddable()}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? '저장 중...' : '추가'}
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="flex justify-center py-16">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed rounded-xl">
          <p className="mb-3">등록된 메뉴가 없습니다.</p>
          <button onClick={openForm} className="text-sm text-blue-600 hover:underline">
            첫 메뉴 추가하기
          </button>
        </div>
      ) : (
        <>
          <div className="mb-2 text-xs text-gray-400">
            카테고리·게시판은 각 관리 탭에서 삭제 가능 · 여기서는 순서와 표시 여부만 변경됩니다.
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {items.map((item) => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                    isGhost={activeId === item.id}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay dropAnimation={null}>
              {draggingItem && dragBadge && (
                <div className="flex items-center gap-2 rounded-lg border-2 border-blue-400 bg-white px-3 py-2.5 text-sm shadow-2xl">
                  <GripVertical className="h-4 w-4 text-blue-400" />
                  <span className="font-medium text-gray-800">{draggingItem.displayName}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ml-auto ${dragBadge.className}`}>
                    {dragBadge.label}
                  </span>
                </div>
              )}
            </DragOverlay>
          </DndContext>

          <p className="mt-4 text-xs text-gray-400 text-right">
            총 {items.length}개 · 시스템 {items.filter((i) => i.isSystem).length}개 /
            커스텀 {items.filter((i) => !i.isSystem).length}개
          </p>
        </>
      )}
    </div>
  );
}
