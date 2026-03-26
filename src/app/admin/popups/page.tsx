import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { Plus, Edit, Trash2, X } from 'lucide-react';

interface Popup {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl: string;
  position: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface PopupForm {
  name: string;
  imageUrl: string;
  linkUrl: string;
  position: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  sortOrder: string;
}

const emptyForm: PopupForm = {
  name: '', imageUrl: '', linkUrl: '', position: 'center',
  startsAt: '', endsAt: '', isActive: true, sortOrder: '0',
};

const POSITIONS = [
  { value: 'center', label: '중앙' },
  { value: 'top', label: '상단' },
  { value: 'bottom', label: '하단' },
  { value: 'left', label: '좌측' },
  { value: 'right', label: '우측' },
];

export default function AdminPopupsPage() {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PopupForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadPopups(); }, []);

  async function loadPopups() {
    const supabase = createClient();
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('popups')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setPopups((data || []).map((p: any) => ({
        id: p.id, name: p.name, imageUrl: p.image_url || '', linkUrl: p.link_url || '',
        position: p.position || 'center', startsAt: p.starts_at, endsAt: p.ends_at,
        isActive: p.is_active, sortOrder: p.sort_order || 0,
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() { setEditingId(null); setForm(emptyForm); setShowModal(true); }
  function openEdit(popup: Popup) {
    setEditingId(popup.id);
    setForm({
      name: popup.name,
      imageUrl: popup.imageUrl,
      linkUrl: popup.linkUrl,
      position: popup.position,
      startsAt: popup.startsAt ? popup.startsAt.slice(0, 16) : '',
      endsAt: popup.endsAt ? popup.endsAt.slice(0, 16) : '',
      isActive: popup.isActive,
      sortOrder: String(popup.sortOrder),
    });
    setShowModal(true);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const supabase = createClient();
    try {
      const payload = {
        name: form.name,
        image_url: form.imageUrl || null,
        link_url: form.linkUrl || null,
        position: form.position,
        starts_at: form.startsAt || null,
        ends_at: form.endsAt || null,
        is_active: form.isActive,
        sort_order: parseInt(form.sortOrder) || 0,
      };
      if (editingId) {
        const { error } = await supabase.from('popups').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('popups').insert(payload);
        if (error) throw error;
      }
      setShowModal(false);
      await loadPopups();
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('팝업을 삭제하시겠습니까?')) return;
    const supabase = createClient();
    await supabase.from('popups').delete().eq('id', id);
    await loadPopups();
  }

  async function handleToggleActive(id: string, current: boolean) {
    const supabase = createClient();
    await supabase.from('popups').update({ is_active: !current }).eq('id', id);
    await loadPopups();
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">팝업 관리</h1>
          <p className="text-sm text-gray-500 mt-1">사이트에 표시될 팝업을 관리합니다.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />팝업 추가</Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-200 animate-pulse rounded" />)}
        </div>
      ) : popups.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="mb-4 text-gray-500">등록된 팝업이 없습니다.</p>
          <Button onClick={openCreate}>팝업 추가하기</Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">순서</th>
                  <th className="px-4 py-3 text-left">이름</th>
                  <th className="px-4 py-3 text-left">위치</th>
                  <th className="px-4 py-3 text-left">노출 기간</th>
                  <th className="px-4 py-3 text-left">상태</th>
                  <th className="px-4 py-3 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {popups.map((popup) => (
                  <tr key={popup.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{popup.sortOrder}</td>
                    <td className="px-4 py-3 font-medium">{popup.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {POSITIONS.find(p => p.value === popup.position)?.label || popup.position}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {popup.startsAt ? format(new Date(popup.startsAt), 'yyyy.MM.dd HH:mm') : '즉시'} ~{' '}
                      {popup.endsAt ? format(new Date(popup.endsAt), 'yyyy.MM.dd HH:mm') : '무기한'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={popup.isActive ? 'default' : 'secondary'}>
                        {popup.isActive ? '활성' : '비활성'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleToggleActive(popup.id, popup.isActive)}>
                          {popup.isActive ? '비활성화' : '활성화'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(popup)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(popup.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 팝업 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingId ? '팝업 수정' : '팝업 추가'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">팝업명 *</label>
                <input name="name" value={form.name} onChange={handleChange} required
                  placeholder="봄 프로모션 팝업"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">표시 위치</label>
                  <select name="position" value={form.position} onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">정렬 순서</label>
                  <input type="number" name="sortOrder" value={form.sortOrder} onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">이미지 URL</label>
                <input name="imageUrl" value={form.imageUrl} onChange={handleChange}
                  placeholder="https://..."
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">링크 URL (클릭 시 이동)</label>
                <input name="linkUrl" value={form.linkUrl} onChange={handleChange}
                  placeholder="https://..."
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">노출 시작일</label>
                  <input type="datetime-local" name="startsAt" value={form.startsAt} onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="mt-0.5 text-xs text-gray-400">비워두면 즉시 노출</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">노출 종료일</label>
                  <input type="datetime-local" name="endsAt" value={form.endsAt} onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="mt-0.5 text-xs text-gray-400">비워두면 무기한 노출</p>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="isActive" checked={form.isActive}
                  onChange={(e) => setForm(prev => ({ ...prev, isActive: e.target.checked }))} className="rounded" />
                <span className="text-sm font-medium">즉시 활성화</span>
              </label>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? '저장 중...' : editingId ? '수정' : '추가'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>취소</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
