import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, X, Search, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ContentPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  type: string;
  excerpt: string | null;
  parent_id: string | null;
  is_visible: boolean;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  view_count: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface PageForm {
  title: string;
  slug: string;
  content: string;
  type: string;
  excerpt: string;
  is_visible: boolean;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  sort_order: number;
}

const PAGE_TYPES = [
  { value: 'custom', label: '커스텀' },
  { value: 'terms', label: '이용약관' },
  { value: 'privacy', label: '개인정보처리방침' },
  { value: 'about', label: '소개' },
  { value: 'guide', label: '가이드' },
];

const emptyForm: PageForm = {
  title: '',
  slug: '',
  content: '',
  type: 'custom',
  excerpt: '',
  is_visible: true,
  seo_title: '',
  seo_description: '',
  seo_keywords: '',
  sort_order: 0,
};

export default function AdminContentPagesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PageForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      fetchPages();
    }
  }, [user, authLoading, navigate]);

  async function fetchPages() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('content_pages')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPages(data || []);
    } catch (err) {
      console.error('콘텐츠 페이지 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  function generateSlug(title: string) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function handleTitleChange(title: string) {
    setForm((prev) => ({
      ...prev,
      title,
      slug: prev.slug === generateSlug(prev.title) || !prev.slug ? generateSlug(title) : prev.slug,
    }));
  }

  function handleAddNew() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function handleEdit(page: ContentPage) {
    setEditingId(page.id);
    setForm({
      title: page.title,
      slug: page.slug,
      content: page.content || '',
      type: page.type || 'custom',
      excerpt: page.excerpt || '',
      is_visible: page.is_visible,
      seo_title: page.seo_title || '',
      seo_description: page.seo_description || '',
      seo_keywords: page.seo_keywords || '',
      sort_order: page.sort_order,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.slug.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        title: form.title,
        slug: form.slug,
        content: form.content,
        type: form.type,
        excerpt: form.excerpt || null,
        is_visible: form.is_visible,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
        seo_keywords: form.seo_keywords || null,
        sort_order: form.sort_order,
      };

      if (editingId) {
        const { error } = await supabase
          .from('content_pages')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('content_pages')
          .insert(payload);
        if (error) throw error;
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await fetchPages();
    } catch (err) {
      console.error('콘텐츠 페이지 저장 실패:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`"${title}" 페이지를 삭제하시겠습니까?`)) return;
    setDeletingId(id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('content_pages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchPages();
    } catch (err) {
      console.error('콘텐츠 페이지 삭제 실패:', err);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleVisibility(page: ContentPage) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('content_pages')
        .update({ is_visible: !page.is_visible, updated_at: new Date().toISOString() })
        .eq('id', page.id);

      if (error) throw error;
      await fetchPages();
    } catch (err) {
      console.error('공개 상태 변경 실패:', err);
    }
  }

  const filteredPages = pages.filter((page) => {
    const matchesSearch =
      !searchQuery ||
      page.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      page.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !filterType || page.type === filterType;
    return matchesSearch && matchesType;
  });

  const getTypeLabel = (type: string) => {
    return PAGE_TYPES.find((t) => t.value === type)?.label || type;
  };

  if (authLoading || loading) {
    return <div className="container py-8 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">콘텐츠 페이지 관리</h1>
        <Button onClick={handleAddNew}>
          <Plus className="mr-1.5 h-4 w-4" />
          페이지 추가
        </Button>
      </div>

      {/* 검색 및 필터 */}
      <Card className="mb-6 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제목 또는 슬러그로 검색..."
              className="w-full rounded-md border py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 유형</option>
            {PAGE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* 페이지 추가/수정 폼 */}
      {showForm && (
        <Card className="mb-6 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{editingId ? '페이지 수정' : '새 페이지 추가'}</h2>
            <button onClick={() => setShowForm(false)}>
              <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">제목 *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="페이지 제목"
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
                placeholder="page-slug"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">유형</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PAGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">정렬 순서</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                min={0}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">요약</label>
              <input
                type="text"
                value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                placeholder="페이지 요약 (선택사항)"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">내용</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="HTML 콘텐츠를 입력하세요..."
                rows={10}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.is_visible}
                  onChange={(e) => setForm({ ...form, is_visible: e.target.checked })}
                  className="rounded border-gray-300"
                />
                공개 여부
              </label>
            </div>

            {/* SEO 설정 */}
            <div className="sm:col-span-2">
              <h3 className="mb-3 text-sm font-semibold text-gray-600">SEO 설정</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">SEO 제목</label>
                  <input
                    type="text"
                    value={form.seo_title}
                    onChange={(e) => setForm({ ...form, seo_title: e.target.value })}
                    placeholder="검색엔진 노출 제목"
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">SEO 키워드</label>
                  <input
                    type="text"
                    value={form.seo_keywords}
                    onChange={(e) => setForm({ ...form, seo_keywords: e.target.value })}
                    placeholder="키워드1, 키워드2, ..."
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium">SEO 설명</label>
                  <textarea
                    value={form.seo_description}
                    onChange={(e) => setForm({ ...form, seo_description: e.target.value })}
                    placeholder="검색엔진 노출 설명"
                    rows={2}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
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

      {/* 페이지 목록 */}
      <Card>
        {filteredPages.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {searchQuery || filterType ? '검색 결과가 없습니다.' : '등록된 콘텐츠 페이지가 없습니다.'}
          </div>
        ) : (
          <div className="divide-y">
            {filteredPages.map((page) => (
              <div
                key={page.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{page.title}</span>
                    <span className="text-xs text-gray-400">/{page.slug}</span>
                    <Badge variant="secondary" className="text-xs">
                      {getTypeLabel(page.type)}
                    </Badge>
                    {!page.is_visible && (
                      <Badge variant="outline" className="text-xs text-gray-400">
                        비공개
                      </Badge>
                    )}
                  </div>
                  {page.excerpt && (
                    <span className="text-xs text-gray-500 line-clamp-1">{page.excerpt}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="mr-2 text-xs text-gray-400">조회 {page.view_count}</span>
                  <span className="mr-2 text-xs text-gray-400">순서: {page.sort_order}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleVisibility(page)}
                    className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600"
                    title={page.is_visible ? '비공개로 전환' : '공개로 전환'}
                  >
                    {page.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(page)}
                    className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(page.id, page.title)}
                    disabled={deletingId === page.id}
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
