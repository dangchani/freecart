import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, ChevronRight, X } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  sortOrder: number;
  children?: Category[];
}

interface CategoryForm {
  name: string;
  slug: string;
  parentId: string;
  sortOrder: number;
}

const emptyForm: CategoryForm = { name: '', slug: '', parentId: '', sortOrder: 0 };

export default function AdminCategoriesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      fetchCategories();
    }
  }, [user, authLoading, navigate]);

  async function fetchCategories() {
    try {
      const res = await fetch('/api/admin/categories');
      const json = await res.json();
      if (json.success) setCategories(json.data || []);
    } catch (err) {
      console.error('카테고리 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function handleNameChange(name: string) {
    setForm((prev) => ({
      ...prev,
      name,
      slug: prev.slug === generateSlug(prev.name) || !prev.slug ? generateSlug(name) : prev.slug,
    }));
  }

  function handleEdit(category: Category) {
    setEditingId(category.id);
    setForm({
      name: category.name,
      slug: category.slug,
      parentId: category.parentId || '',
      sortOrder: category.sortOrder,
    });
    setShowForm(true);
  }

  function handleAddNew() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) return;
    setSaving(true);
    try {
      const url = editingId ? `/api/admin/categories/${editingId}` : '/api/admin/categories';
      const method = editingId ? 'PATCH' : 'POST';
      const body = { ...form, parentId: form.parentId || null };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm);
        await fetchCategories();
      } else {
        alert(json.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('카테고리 저장 실패:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 카테고리를 삭제하시겠습니까?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        await fetchCategories();
      } else {
        alert(json.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      console.error('카테고리 삭제 실패:', err);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  }

  // 플랫 목록 반환 (트리 렌더링용)
  function flattenCategories(cats: Category[], level = 0): Array<{ cat: Category; level: number }> {
    const result: Array<{ cat: Category; level: number }> = [];
    for (const cat of cats) {
      result.push({ cat, level });
      if (cat.children && cat.children.length > 0) {
        result.push(...flattenCategories(cat.children, level + 1));
      }
    }
    return result;
  }

  // 부모 카테고리 목록 (최상위만)
  const rootCategories = categories.filter((c) => !c.parentId);
  const flatList = flattenCategories(categories);

  if (authLoading || loading) {
    return <div className="container py-8 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">카테고리 관리</h1>
        <Button onClick={handleAddNew}>
          <Plus className="mr-1.5 h-4 w-4" />
          카테고리 추가
        </Button>
      </div>

      {/* 카테고리 추가/수정 폼 */}
      {showForm && (
        <Card className="mb-6 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{editingId ? '카테고리 수정' : '새 카테고리 추가'}</h2>
            <button onClick={() => setShowForm(false)}>
              <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">카테고리명 *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="카테고리명"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">슬러그 (URL) *</label>
              <input
                type="text"
                required
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="category-slug"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">상위 카테고리</label>
              <select
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">최상위 카테고리</option>
                {rootCategories
                  .filter((c) => c.id !== editingId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">정렬 순서</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                min={0}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                취소
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? '저장 중...' : '저장하기'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* 카테고리 트리 */}
      <Card>
        {flatList.length === 0 ? (
          <div className="p-12 text-center text-gray-500">등록된 카테고리가 없습니다.</div>
        ) : (
          <div className="divide-y">
            {flatList.map(({ cat, level }) => (
              <div
                key={cat.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                style={{ paddingLeft: `${16 + level * 24}px` }}
              >
                <div className="flex items-center gap-2">
                  {level > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
                  <span className={level === 0 ? 'font-medium' : 'text-sm text-gray-700'}>
                    {cat.name}
                  </span>
                  <span className="text-xs text-gray-400">/{cat.slug}</span>
                  {cat.children && cat.children.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      하위 {cat.children.length}개
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="mr-2 text-xs text-gray-400">순서: {cat.sortOrder}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(cat)}
                    className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(cat.id, cat.name)}
                    disabled={deletingId === cat.id}
                    className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
