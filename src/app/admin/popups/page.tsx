import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { Plus, Edit, Trash2 } from 'lucide-react';

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

export default function AdminPopupsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PopupForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate('/auth/login'); return; }
      loadPopups();
    }
  }, [user, authLoading, navigate]);

  async function loadPopups() {
    const supabase = createClient();
    try {
      setLoading(true);
      const { data, error: err } = await supabase.from('popups').select('*').order('sort_order');
      if (err) throw err;
      setPopups(data?.map((p: any) => ({
        id: p.id, name: p.name, imageUrl: p.image_url, linkUrl: p.link_url,
        position: p.position, startsAt: p.starts_at, endsAt: p.ends_at,
        isActive: p.is_active, sortOrder: p.sort_order,
      })) || []);
    } catch {
      setError('팝업 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() { setEditingId(null); setForm(emptyForm); setShowModal(true); }
  function openEdit(popup: Popup) {
    setEditingId(popup.id);
    setForm({ name: popup.name, imageUrl: popup.imageUrl || '', linkUrl: popup.linkUrl || '',
      position: popup.position, startsAt: popup.startsAt ? popup.startsAt.slice(0, 16) : '',
      endsAt: popup.endsAt ? popup.endsAt.slice(0, 16) : '', isActive: popup.isActive, sortOrder: String(popup.sortOrder) });
    setShowModal(true);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const supabase = createClient();
    try {
      const payload = { name: form.name, image_url: form.imageUrl, link_url: form.linkUrl,
        position: form.position, starts_at: form.startsAt || null, ends_at: form.endsAt || null,
        is_active: form.isActive, sort_order: parseInt(form.sortOrder) || 0 };
      if (editingId) {
        await supabase.from('popups').update(payload).eq('id', editingId);
      } else {
        await supabase.from('popups').insert(payload);
      }
      setShowModal(false);
      await loadPopups();
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(popupId: string) {
    if (!confirm('팝업을 삭제하시겠습니까?')) return;
    const supabase = createClient();
    await supabase.from('popups').delete().eq('id', popupId);
    await loadPopups();
  }

  async function handleToggleActive(popupId: string, current: boolean) {
    const supabase = createClient();
    await supabase.from('popups').update({ is_active: !current }).eq('id', popupId);
    await loadPopups();
  }

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">팝업 관리</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />팝업 추가</Button>
      </div>
      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}
      {loading ? <div className="py-8 text-center text-gray-500">로딩 중...</div>
        : popups.length === 0 ? (
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
                    <th className="px-4 py-3 text-left">이름</th>
                    <th className="px-4 py-3 text-left">위치</th>
                    <th className="px-4 py-3 text-left">기간</th>
                    <th className="px-4 py-3 text-left">상태</th>
                    <th className="px-4 py-3 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {popups.map((popup) => (
                    <tr key={popup.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{popup.name}</td>
                      <td className="px-4 py-3 text-gray-600">{popup.position}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {popup.startsAt ? format(new Date(popup.startsAt), 'yyyy.MM.dd') : '-'} ~ {popup.endsAt ? format(new Date(popup.endsAt), 'yyyy.MM.dd') : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={popup.isActive ? 'default' : 'secondary'}>{popup.isActive ? '활성' : '비활성'}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => handleToggleActive(popup.id, popup.isActive)}>{popup.isActive ? '비활성화' : '활성화'}</Button>
                          <Button size="sm" variant="outline" onClick={() => openEdit(popup)}><Edit className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(popup.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg p-6">
            <h2 className="mb-4 text-lg font-bold">{editingId ? '팝업 수정' : '팝업 추가'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">이름</label>
                <input type="text" name="name" value={form.name} onChange={handleChange} required className="w-full rounded-md border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">이미지 URL</label>
                <input type="text" name="imageUrl" value={form.imageUrl} onChange={handleChange} className="w-full rounded-md border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">링크 URL</label>
                <input type="text" name="linkUrl" value={form.linkUrl} onChange={handleChange} className="w-full rounded-md border px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting}>{submitting ? '처리 중...' : editingId ? '수정' : '추가'}</Button>
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>취소</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
