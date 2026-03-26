import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Trash2, Edit, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface MenuItem {
  id: string;
  label: string;
  url: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  children?: MenuItem[];
}

interface MenuForm {
  label: string;
  url: string;
  parentId: string;
  sortOrder: string;
  isActive: boolean;
}

const emptyForm: MenuForm = {
  label: '',
  url: '',
  parentId: '',
  sortOrder: '0',
  isActive: true,
};

export default function AdminMenusPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [flatMenus, setFlatMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MenuForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadMenus();
    }
  }, [user, authLoading, navigate]);

  async function loadMenus() {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('menus')
        .select('id, name, url, parent_id, sort_order, is_visible')
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;

      const flat: MenuItem[] = (data || []).map((m) => ({
        id: m.id,
        label: m.name,
        url: m.url || '',
        parentId: m.parent_id,
        sortOrder: m.sort_order,
        isActive: m.is_visible,
      }));

      setFlatMenus(flat);
      const tree = buildTree(flat);
      setMenus(tree);
    } catch {
      setError('메뉴를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function buildTree(items: MenuItem[]): MenuItem[] {
    const map: Record<string, MenuItem> = {};
    items.forEach((item) => {
      map[item.id] = { ...item, children: [] };
    });
    const roots: MenuItem[] = [];
    items.forEach((item) => {
      const parent = item.parentId ? map[item.parentId] : undefined;
      if (parent) {
        parent.children!.push(map[item.id]!);
      } else {
        roots.push(map[item.id]!);
      }
    });
    return roots;
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(item: MenuItem) {
    setEditingId(item.id);
    setForm({
      label: item.label,
      url: item.url,
      parentId: item.parentId || '',
      sortOrder: String(item.sortOrder),
      isActive: item.isActive,
    });
    setShowForm(true);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const supabase = createClient();
      const payload = {
        name: form.label,
        url: form.url,
        parent_id: form.parentId || null,
        sort_order: parseInt(form.sortOrder) || 0,
        is_visible: form.isActive,
      };

      if (editingId) {
        const { error } = await supabase.from('menus').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('menus').insert(payload);
        if (error) throw error;
      }

      setShowForm(false);
      await loadMenus();
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(menuId: string) {
    if (!confirm('메뉴를 삭제하시겠습니까? 하위 메뉴도 함께 삭제됩니다.')) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('menus').delete().eq('id', menuId);
      if (error) throw error;
      await loadMenus();
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.');
    }
  }

  function renderMenuItem(item: MenuItem, depth = 0) {
    return (
      <div key={item.id}>
        <div
          className={`flex items-center gap-3 py-2.5 hover:bg-gray-50 pr-4`}
          style={{ paddingLeft: `${16 + depth * 24}px` }}
        >
          {depth > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
          <div className="flex-1">
            <span className={`font-medium ${!item.isActive ? 'text-gray-400' : ''}`}>{item.label}</span>
            <span className="ml-2 text-xs text-gray-400">{item.url}</span>
            {!item.isActive && <span className="ml-2 text-xs text-gray-400">(비활성)</span>}
          </div>
          <span className="text-xs text-gray-400">순서: {item.sortOrder}</span>
          <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)}>
            <Trash2 className="h-3.5 w-3.5 text-red-500" />
          </Button>
        </div>
        {item.children && item.children.length > 0 && (
          <div className="border-l border-gray-100 ml-6">
            {item.children.sort((a, b) => a.sortOrder - b.sortOrder).map((child) => renderMenuItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">메뉴 관리</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          메뉴 추가
        </Button>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

      {showForm && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-lg font-bold">{editingId ? '메뉴 수정' : '메뉴 추가'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">메뉴명</label>
                <input type="text" name="label" value={form.label} onChange={handleChange} required className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="메뉴명" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">URL</label>
                <input type="text" name="url" value={form.url} onChange={handleChange} required className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="/products" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">상위 메뉴</label>
                <select name="parentId" value={form.parentId} onChange={handleChange} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">최상위 메뉴</option>
                  {flatMenus.filter((m) => !m.parentId && m.id !== editingId).map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">정렬 순서</label>
                <input type="number" name="sortOrder" value={form.sortOrder} onChange={handleChange} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="menuActive" name="isActive" checked={form.isActive} onChange={handleChange} className="h-4 w-4 rounded border-gray-300" />
              <label htmlFor="menuActive" className="text-sm font-medium text-gray-700">활성화</label>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={submitting}>{submitting ? '처리 중...' : editingId ? '수정' : '추가'}</Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>취소</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-500">로딩 중...</div>
      ) : menus.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="mb-4 text-gray-500">등록된 메뉴가 없습니다.</p>
          <Button onClick={openCreate}>메뉴 추가하기</Button>
        </Card>
      ) : (
        <Card>
          <div className="divide-y">
            {menus.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => renderMenuItem(item))}
          </div>
        </Card>
      )}
    </div>
  );
}
