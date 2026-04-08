import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
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
import { GripVertical, Plus, Trash2, Edit2, ChevronRight, X, Save, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface MenuItem {
  id: string;
  label: string;
  url: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  children: MenuItem[];
}

interface FlatItem extends Omit<MenuItem, 'children'> {
  depth: number;
}

const INDENT = 28; // px per depth level
const MAX_DEPTH = 1; // 최대 2단계 (0, 1)

function flattenTree(items: MenuItem[], depth = 0): FlatItem[] {
  const result: FlatItem[] = [];
  for (const item of items) {
    result.push({ ...item, depth });
    if (item.children.length > 0) {
      result.push(...flattenTree(item.children, depth + 1));
    }
  }
  return result;
}

function buildTree(rows: Omit<FlatItem, 'depth'>[]): MenuItem[] {
  const map: Record<string, MenuItem> = {};
  rows.forEach((r) => { map[r.id] = { ...r, children: [] }; });
  const roots: MenuItem[] = [];
  rows.forEach((r) => {
    if (r.parentId && map[r.parentId]) {
      map[r.parentId].children.push(map[r.id]);
    } else {
      roots.push(map[r.id]);
    }
  });
  const sort = (items: MenuItem[]) => {
    items.sort((a, b) => a.sortOrder - b.sortOrder);
    items.forEach((i) => sort(i.children));
  };
  sort(roots);
  return roots;
}

/** 드롭 위치 + horizontal delta → 예상 depth/parentId 계산 */
function getProjection(
  items: FlatItem[],
  activeId: string,
  overId: string,
  dragOffsetX: number
): { depth: number; parentId: string | null } {
  const overIdx = items.findIndex((i) => i.id === overId);
  const activeItem = items.find((i) => i.id === activeId);
  if (!activeItem || overIdx === -1) return { depth: 0, parentId: null };

  const rawDepth = activeItem.depth + Math.round(dragOffsetX / INDENT);
  const clampedDepth = Math.max(0, Math.min(MAX_DEPTH, rawDepth));

  if (clampedDepth === 0) return { depth: 0, parentId: null };

  // depth=1 → 위쪽에서 가장 가까운 최상위 항목을 부모로
  for (let i = overIdx; i >= 0; i--) {
    const candidate = items[i];
    if (candidate.id === activeId) continue;
    if (candidate.depth === 0) {
      return { depth: 1, parentId: candidate.id };
    }
  }
  return { depth: 0, parentId: null };
}

function SortableRow({
  item,
  projected,
  onEdit,
  onDelete,
  onToggleActive,
  isGhost,
}: {
  item: FlatItem;
  projected?: { depth: number; parentId: string | null } | null;
  onEdit: (item: FlatItem) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, val: boolean) => void;
  isGhost?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isSorting } =
    useSortable({ id: item.id });

  const displayDepth = projected ? projected.depth : item.depth;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isSorting ? transition : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={isGhost ? 'opacity-40' : ''}>
      <div
        className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors"
        style={{ marginLeft: `${displayDepth * INDENT}px` }}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-gray-300 hover:text-gray-500 active:cursor-grabbing shrink-0"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {displayDepth > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />}

        <span className={`flex-1 font-medium truncate ${!item.isActive ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
          {item.label}
        </span>

        <span className="hidden sm:block text-xs text-gray-400 max-w-[180px] truncate shrink-0">{item.url}</span>

        {displayDepth === 0
          ? <span className="hidden sm:block text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">상위</span>
          : <span className="hidden sm:block text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">서브</span>
        }

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => onToggleActive(item.id, !item.isActive)}
            className={`p-1.5 rounded hover:bg-gray-100 ${item.isActive ? 'text-green-500' : 'text-gray-300'}`}
            title={item.isActive ? '비활성화' : '활성화'}
          >
            {item.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => onEdit(item)} className="p-1.5 rounded text-blue-500 hover:bg-blue-50" title="수정">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(item.id)} className="p-1.5 rounded text-red-400 hover:bg-red-50" title="삭제">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminMenusPage() {
  const [tree, setTree] = useState<MenuItem[]>([]);
  const [flat, setFlat] = useState<FlatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetX, setOffsetX] = useState(0);

  // 폼
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formParentId, setFormParentId] = useState('');
  const [formActive, setFormActive] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const projected =
    activeId && overId
      ? getProjection(flat, activeId, overId, offsetX)
      : null;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => { loadMenus(); }, []);
  useEffect(() => { setFlat(flattenTree(tree)); }, [tree]);

  async function loadMenus() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('menus')
        .select('id, name, url, parent_id, sort_order, is_visible')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const rows = (data || []).map((m) => ({
        id: m.id,
        label: m.name,
        url: m.url || '',
        parentId: m.parent_id,
        sortOrder: m.sort_order,
        isActive: m.is_visible ?? true,
      }));
      setTree(buildTree(rows));
    } catch {
      showToast('메뉴를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
    setOverId(active.id as string);
    setOffsetX(0);
  }

  function handleDragMove({ delta, over }: DragMoveEvent) {
    setOffsetX(delta.x);
    if (over) setOverId(over.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const prevActiveId = activeId;
    const prevOverId = overId;
    const prevOffsetX = offsetX;

    setActiveId(null);
    setOverId(null);
    setOffsetX(0);

    if (!over || !prevActiveId) return;

    const activeIdx = flat.findIndex((f) => f.id === prevActiveId);
    const overIdx = flat.findIndex((f) => f.id === (prevOverId ?? over.id));
    if (activeIdx === -1 || overIdx === -1) return;

    const proj = getProjection(flat, prevActiveId, prevOverId ?? (over.id as string), prevOffsetX);

    const reordered = arrayMove(flat, activeIdx, overIdx);
    const updated = reordered.map((item, idx) => ({
      ...item,
      sortOrder: idx,
      parentId: item.id === prevActiveId ? proj.parentId : item.parentId,
    }));

    setTree(buildTree(updated.map(({ depth: _d, ...rest }) => rest)));
    saveOrder(updated);
  }

  function handleDragCancel() {
    setActiveId(null);
    setOverId(null);
    setOffsetX(0);
  }

  async function saveOrder(items: FlatItem[]) {
    setSaving(true);
    try {
      const supabase = createClient();
      for (const [idx, item] of items.entries()) {
        await supabase
          .from('menus')
          .update({ sort_order: idx, parent_id: item.parentId })
          .eq('id', item.id);
      }
    } catch {
      showToast('순서 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setFormLabel(''); setFormUrl(''); setFormParentId(''); setFormActive(true);
    setShowForm(true);
  }

  function openEdit(item: FlatItem) {
    setEditingId(item.id);
    setFormLabel(item.label); setFormUrl(item.url);
    setFormParentId(item.parentId || ''); setFormActive(item.isActive);
    setShowForm(true);
  }

  function closeForm() { setShowForm(false); setEditingId(null); }

  async function handleSave() {
    if (!formLabel.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        name: formLabel.trim(),
        url: formUrl.trim() || '/',
        parent_id: formParentId || null,
        is_visible: formActive,
        sort_order: editingId ? undefined : flat.length,
      };
      if (editingId) {
        const { error } = await supabase.from('menus').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('menus').insert(payload);
        if (error) throw error;
      }
      closeForm();
      await loadMenus();
      showToast(editingId ? '수정되었습니다.' : '추가되었습니다.');
    } catch {
      showToast('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const item = flat.find((f) => f.id === id);
    const hasChildren = flat.some((f) => f.parentId === id);
    const msg = hasChildren
      ? `"${item?.label}" 메뉴를 삭제하면 하위 메뉴도 함께 삭제됩니다. 계속하시겠습니까?`
      : `"${item?.label}" 메뉴를 삭제하시겠습니까?`;
    if (!confirm(msg)) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('menus').delete().eq('id', id);
      if (error) throw error;
      await loadMenus();
      showToast('삭제되었습니다.');
    } catch {
      showToast('삭제에 실패했습니다.');
    }
  }

  async function handleToggleActive(id: string, val: boolean) {
    try {
      const supabase = createClient();
      await supabase.from('menus').update({ is_visible: val }).eq('id', id);
      setTree((prev) => {
        const toggle = (items: MenuItem[]): MenuItem[] =>
          items.map((i) => i.id === id ? { ...i, isActive: val } : { ...i, children: toggle(i.children) });
        return toggle(prev);
      });
    } catch {
      showToast('상태 변경에 실패했습니다.');
    }
  }

  const topLevelItems = flat.filter((f) => f.depth === 0 && f.id !== editingId);
  const draggingItem = activeId ? flat.find((f) => f.id === activeId) : null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm">{toast}</div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">메뉴 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            드래그로 순서 변경 · <span className="text-blue-500">좌우로 이동하면 상위/서브 메뉴 전환</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-gray-400 animate-pulse">저장 중...</span>}
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            메뉴 추가
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-5 border rounded-xl p-5 bg-blue-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{editingId ? '메뉴 수정' : '새 메뉴 추가'}</h3>
            <button onClick={closeForm}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">메뉴명 *</label>
              <input
                type="text" value={formLabel} onChange={(e) => setFormLabel(e.target.value)}
                placeholder="예: 전체 상품"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">링크 URL</label>
              <input
                type="text" value={formUrl} onChange={(e) => setFormUrl(e.target.value)}
                placeholder="/products"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상위 메뉴</label>
              <select
                value={formParentId} onChange={(e) => setFormParentId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">최상위 (없음)</option>
                {topLevelItems.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">활성화 (사이트에 표시)</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={closeForm} className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50">취소</button>
            <button
              onClick={handleSave} disabled={saving || !formLabel.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />{saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
        </div>
      ) : flat.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed rounded-xl">
          <p className="mb-3">등록된 메뉴가 없습니다.</p>
          <button onClick={openCreate} className="text-sm text-blue-600 hover:underline">첫 메뉴 추가하기</button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-1.5 text-xs text-gray-400">
            <GripVertical className="h-3.5 w-3.5" />
            <span>드래그로 순서 변경 — 드래그 중 <strong>오른쪽</strong>으로 밀면 서브메뉴, <strong>왼쪽</strong>으로 당기면 상위메뉴</span>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={flat.map((f) => f.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {flat.map((item) => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    projected={activeId === item.id ? projected : null}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onToggleActive={handleToggleActive}
                    isGhost={activeId === item.id}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay dropAnimation={null}>
              {draggingItem && (
                <div
                  className="flex items-center gap-2 rounded-lg border-2 border-blue-400 bg-white px-3 py-2.5 text-sm shadow-2xl"
                  style={{ marginLeft: `${(projected?.depth ?? draggingItem.depth) * INDENT}px` }}
                >
                  <GripVertical className="h-4 w-4 text-blue-400" />
                  {(projected?.depth ?? draggingItem.depth) > 0 && (
                    <ChevronRight className="h-3.5 w-3.5 text-blue-300" />
                  )}
                  <span className="font-medium text-gray-800">{draggingItem.label}</span>
                  {(projected?.depth ?? draggingItem.depth) === 0
                    ? <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded ml-auto">상위</span>
                    : <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded ml-auto">서브</span>
                  }
                </div>
              )}
            </DragOverlay>
          </DndContext>

          <p className="mt-4 text-xs text-gray-400 text-right">
            총 {flat.length}개 · 상위 {flat.filter(f => f.depth === 0).length}개 / 서브 {flat.filter(f => f.depth > 0).length}개
          </p>
        </>
      )}
    </div>
  );
}
