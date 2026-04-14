import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Edit, Trash2, Upload, X, ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Banner {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl: string;
  position: string;
  isActive: boolean;
  sortOrder: number;
}

interface BannerForm {
  name: string;
  imageUrl: string;       // 현재 저장된 URL (수정 시 기존 이미지)
  linkUrl: string;
  isActive: boolean;
  sortOrder: string;
}

const emptyForm: BannerForm = {
  name: '',
  imageUrl: '',
  linkUrl: '',
  isActive: true,
  sortOrder: '0',
};

async function uploadBannerImage(file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('banners').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(path);
  return publicUrl;
}

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

  // 이미지 업로드 관련
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');   // 로컬 미리보기 or 기존 URL
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate('/auth/login'); return; }
      loadBanners();
    }
  }, [user, authLoading, navigate]);

  async function loadBanners() {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('banners')
        .select('id, name, image_url, link_url, position, is_active, sort_order')
        .order('sort_order', { ascending: true });
      if (fetchError) throw fetchError;
      setBanners(
        (data || []).map((b) => ({
          id: b.id,
          name: b.name,
          imageUrl: b.image_url,
          linkUrl: b.link_url || '',
          position: b.position,
          isActive: b.is_active,
          sortOrder: b.sort_order,
        }))
      );
    } catch {
      setError('배너 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setPreviewUrl('');
    setUploadFile(null);
    setShowModal(true);
  }

  function openEdit(banner: Banner) {
    setEditingId(banner.id);
    setForm({
      name: banner.name,
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl || '',
      isActive: banner.isActive,
      sortOrder: String(banner.sortOrder),
    });
    setPreviewUrl(banner.imageUrl);
    setUploadFile(null);
    setShowModal(true);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleRemoveImage() {
    setUploadFile(null);
    setPreviewUrl('');
    setForm((prev) => ({ ...prev, imageUrl: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // 이미지가 없으면 차단
    if (!previewUrl && !uploadFile) {
      alert('배너 이미지를 등록해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      let finalImageUrl = form.imageUrl;

      // 새 파일이 선택된 경우 업로드
      if (uploadFile) {
        setUploading(true);
        finalImageUrl = await uploadBannerImage(uploadFile);
        setUploading(false);
      }

      const supabase = createClient();
      const payload = {
        name: form.name,
        image_url: finalImageUrl,
        link_url: form.linkUrl || null,
        position: 'main',
        is_active: form.isActive,
        sort_order: parseInt(form.sortOrder) || 0,
      };

      if (editingId) {
        const { error } = await supabase.from('banners').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('banners').insert(payload);
        if (error) throw error;
      }

      setShowModal(false);
      await loadBanners();
    } catch (err) {
      setUploading(false);
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(bannerId: string) {
    if (!confirm('배너를 삭제하시겠습니까?')) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from('banners').delete().eq('id', bannerId);
      if (error) throw error;
      await loadBanners();
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.');
    }
  }

  async function handleToggleActive(bannerId: string, current: boolean) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('banners')
        .update({ is_active: !current })
        .eq('id', bannerId);
      if (error) throw error;
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

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

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
                  <th className="px-4 py-3 text-center font-medium text-gray-600">순서</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">사용</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {banners.map((banner) => (
                  <tr key={banner.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {banner.imageUrl ? (
                        <div className="h-12 w-24 overflow-hidden rounded bg-gray-100">
                          <img src={banner.imageUrl} alt={banner.name} className="object-cover w-full h-full" />
                        </div>
                      ) : (
                        <div className="flex h-12 w-24 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                          이미지 없음
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{banner.name}</td>
                    <td className="px-4 py-3 text-center text-gray-500 text-sm">{banner.sortOrder}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(banner.id, banner.isActive)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                            banner.isActive ? 'bg-blue-600' : 'bg-gray-200'
                          }`}
                          title={banner.isActive ? '비활성화' : '활성화'}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            banner.isActive ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(banner)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(banner.id)}>
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

      {/* 배너 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="mb-5 text-lg font-bold">{editingId ? '배너 수정' : '배너 추가'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* 이름 */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">배너 이름 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="예: 여름 세일 배너"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 이미지 업로드 */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  배너 이미지 <span className="text-red-500">*</span>
                  <span className="ml-1 text-xs font-normal text-gray-400">(JPG, PNG, WebP, GIF / 최대 10MB)</span>
                </label>

                {previewUrl ? (
                  /* 이미지 미리보기 */
                  <div className="relative rounded-lg overflow-hidden border bg-gray-50">
                    <img
                      src={previewUrl}
                      alt="배너 미리보기"
                      className="w-full object-contain max-h-48"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                      title="이미지 제거"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  /* 업로드 드롭존 */
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 bg-gray-50 hover:bg-blue-50 transition-colors px-4 py-8 flex flex-col items-center gap-2 text-gray-500 hover:text-blue-600"
                  >
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-sm font-medium">클릭하여 이미지 선택</span>
                    <span className="text-xs text-gray-400">권장 비율: 16:5 (예: 1920×600px)</span>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {previewUrl && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    이미지 교체
                  </button>
                )}
              </div>

              {/* 링크 URL */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  클릭 링크 URL
                  <span className="ml-1 text-xs font-normal text-gray-400">(선택)</span>
                </label>
                <input
                  type="text"
                  name="linkUrl"
                  value={form.linkUrl}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 정렬 순서 */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  정렬 순서
                  <span className="ml-1 text-xs font-normal text-gray-400">(숫자가 작을수록 앞에 표시)</span>
                </label>
                <input
                  type="number"
                  name="sortOrder"
                  value={form.sortOrder}
                  onChange={handleChange}
                  min="0"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 활성화 */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="bannerActive"
                  name="isActive"
                  checked={form.isActive}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 accent-blue-600"
                />
                <label htmlFor="bannerActive" className="text-sm font-medium text-gray-700">
                  등록 후 바로 활성화
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting || uploading}>
                  {uploading ? '업로드 중...' : submitting ? '처리 중...' : editingId ? '수정' : '추가'}
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
