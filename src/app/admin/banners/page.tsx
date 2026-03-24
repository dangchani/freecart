import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { Plus, Edit, Trash2 } from 'lucide-react';

interface Banner {
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

interface BannerForm {
  name: string;
  imageUrl: string;
  linkUrl: string;
  position: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  sortOrder: string;
}

const emptyForm: BannerForm = {
  name: '',
  imageUrl: '',
  linkUrl: '',
  position: 'main',
  startsAt: '',
  endsAt: '',
  isActive: true,
  sortOrder: '0',
};

export default function AdminBannersPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadBanners();
    }
  }, [user, authLoading, navigate]);

  async function loadBanners() {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/banners');
      const data = await response.json();
      if (data.success) {
        setBanners(data.data || []);
      } else {
        setError(data.error || '배너 목록을 불러오지 못했습니다.');
      }
    } catch {
      setError('배너 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(banner: Banner) {
    setEditingId(banner.id);
    setForm({
      name: banner.name,
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl || '',
      position: banner.position,
      startsAt: banner.startsAt ? banner.startsAt.slice(0, 16) : '',
      endsAt: banner.endsAt ? banner.endsAt.slice(0, 16) : '',
      isActive: banner.isActive,
      sortOrder: String(banner.sortOrder),
    });
    setShowModal(true);
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
      const payload = {
        name: form.name,
        imageUrl: form.imageUrl,
        linkUrl: form.linkUrl,
        position: form.position,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        isActive: form.isActive,
        sortOrder: parseInt(form.sortOrder) || 0,
      };

      const url = editingId ? `/api/admin/banners/${editingId}` : '/api/admin/banners';
      const method = editingId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      setShowModal(false);
      await loadBanners();
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(bannerId: string) {
    if (!confirm('배너를 삭제하시겠습니까?')) return;
    try {
      const response = await fetch(`/api/admin/banners/${bannerId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      await loadBanners();
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.');
    }
  }

  async function handleToggleActive(bannerId: string, current: boolean) {
    try {
      const response = await fetch(`/api/admin/banners/${bannerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !current }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      await loadBanners();
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    }
  }

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">배너 관리</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          배너 추가
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-500">로딩 중...</div>
      ) : banners.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="mb-4 text-gray-500">등록된 배너가 없습니다.</p>
          <Button onClick={openCreate}>배너 추가하기</Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">미리보기</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">이름</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">위치</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">기간</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">상태</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {banners.map((banner) => (
                  <tr key={banner.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {banner.imageUrl ? (
                        <div className="relative h-12 w-24 overflow-hidden rounded bg-gray-100">
                          <img
                            src={banner.imageUrl}
                            alt={banner.name}
                            className="object-cover w-full h-full"
                          />
                        </div>
                      ) : (
                        <div className="flex h-12 w-24 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                          이미지 없음
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{banner.name}</td>
                    <td className="px-4 py-3 text-gray-600">{banner.position}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {banner.startsAt
                        ? format(new Date(banner.startsAt), 'yyyy.MM.dd')
                        : '시작일 없음'}
                      {' ~ '}
                      {banner.endsAt
                        ? format(new Date(banner.endsAt), 'yyyy.MM.dd')
                        : '종료일 없음'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={banner.isActive ? 'default' : 'secondary'}>
                        {banner.isActive ? '활성' : '비활성'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleActive(banner.id, banner.isActive)}
                        >
                          {banner.isActive ? '비활성화' : '활성화'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(banner)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(banner.id)}
                        >
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg p-6">
            <h2 className="mb-4 text-lg font-bold">
              {editingId ? '배너 수정' : '배너 추가'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">이름</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">이미지 URL</label>
                <input
                  type="text"
                  name="imageUrl"
                  value={form.imageUrl}
                  onChange={handleChange}
                  required
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">링크 URL</label>
                <input
                  type="text"
                  name="linkUrl"
                  value={form.linkUrl}
                  onChange={handleChange}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">위치</label>
                  <select
                    name="position"
                    value={form.position}
                    onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="main">메인</option>
                    <option value="sub">서브</option>
                    <option value="popup">팝업</option>
                    <option value="top">상단</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">정렬 순서</label>
                  <input
                    type="number"
                    name="sortOrder"
                    value={form.sortOrder}
                    onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">시작일</label>
                  <input
                    type="datetime-local"
                    name="startsAt"
                    value={form.startsAt}
                    onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">종료일</label>
                  <input
                    type="datetime-local"
                    name="endsAt"
                    value={form.endsAt}
                    onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="bannerActive"
                  name="isActive"
                  checked={form.isActive}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="bannerActive" className="text-sm font-medium text-gray-700">
                  활성화
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? '처리 중...' : editingId ? '수정' : '추가'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  취소
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
