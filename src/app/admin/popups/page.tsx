import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { Plus, Edit, Trash2, X, GripVertical, ChevronDown, ChevronUp, Upload, ImageIcon } from 'lucide-react';

// ─── 타입 ────────────────────────────────────────────────────────────────────

type PopupType = 'text' | 'image' | 'slide';
type PositionPreset = 'center' | 'top' | 'bottom' | 'left' | 'right' | 'custom';

interface SlideSettings {
  autoplay: boolean;
  autoplayDelay: number;
  loop: boolean;
  navigation: boolean;
  pagination: boolean;
  effect: 'slide' | 'fade';
}

interface PopupImage {
  id?: string;
  image_url: string;
  link_url: string;
  caption: string;
  sort_order: number;
}

interface Popup {
  id: string;
  name: string;
  popupType: PopupType;
  content: string;
  imageUrl: string;
  linkUrl: string;
  slideSettings: SlideSettings;
  images: PopupImage[];
  position: PositionPreset;
  positionX: number;
  positionY: number;
  width: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  showTodayClose: boolean;
  sortOrder: number;
  createdAt: string;
}

interface PopupForm {
  name: string;
  popupType: PopupType;
  content: string;
  imageUrl: string;
  linkUrl: string;
  slideSettings: SlideSettings;
  images: PopupImage[];
  position: PositionPreset;
  positionX: number;
  positionY: number;
  width: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  showTodayClose: boolean;
  sortOrder: string;
}

type SortKey = 'created_at' | 'name' | 'sort_order';

// ─── 상수 ────────────────────────────────────────────────────────────────────

const DEFAULT_SLIDE_SETTINGS: SlideSettings = {
  autoplay: true, autoplayDelay: 3000,
  loop: true, navigation: true, pagination: true, effect: 'slide',
};

const PRESET_POSITIONS: { value: PositionPreset; label: string; style: string }[] = [
  { value: 'top',    label: '상단',   style: 'top-1 left-1/2 -translate-x-1/2' },
  { value: 'left',   label: '좌측',   style: 'left-1 top-1/2 -translate-y-1/2' },
  { value: 'center', label: '중앙',   style: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' },
  { value: 'right',  label: '우측',   style: 'right-1 top-1/2 -translate-y-1/2' },
  { value: 'bottom', label: '하단',   style: 'bottom-1 left-1/2 -translate-x-1/2' },
];

const TYPE_LABELS: Record<PopupType, string> = {
  text: '텍스트', image: '이미지', slide: '슬라이드',
};

const emptyForm = (): PopupForm => ({
  name: '', popupType: 'image', content: '', imageUrl: '', linkUrl: '',
  slideSettings: { ...DEFAULT_SLIDE_SETTINGS },
  images: [],
  position: 'center', positionX: 50, positionY: 50,
  width: '500', startsAt: '', endsAt: '',
  isActive: true, showTodayClose: true, sortOrder: '0',
});

// ─── 스토리지 업로드 헬퍼 ────────────────────────────────────────────────────

async function uploadPopupImage(file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('popups').upload(path, file);
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('popups').getPublicUrl(path);
  return publicUrl;
}

// ─── 이미지 업로드 인풋 ───────────────────────────────────────────────────────

function ImageUploadInput({
  value, onChange, placeholder = '이미지 선택',
}: {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPopupImage(file);
      onChange(url);
    } catch {
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        className={`flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 cursor-pointer transition-colors ${
          uploading ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
        }`}
      >
        {uploading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        ) : (
          <Upload className="h-5 w-5 text-gray-400" />
        )}
        <span className="text-sm text-gray-500">{uploading ? '업로드 중...' : placeholder}</span>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      {value && (
        <div className="relative inline-block">
          <img src={value} alt="미리보기" className="h-24 w-auto rounded border object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 슬라이드 이미지 목록 ─────────────────────────────────────────────────────

function SlideImageList({
  images, onChange,
}: {
  images: PopupImage[];
  onChange: (imgs: PopupImage[]) => void;
}) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  function add() {
    onChange([...images, { image_url: '', link_url: '', caption: '', sort_order: images.length }]);
  }
  function remove(i: number) { onChange(images.filter((_, j) => j !== i)); }
  function update(i: number, field: keyof PopupImage, value: string) {
    const next = [...images];
    next[i] = { ...next[i], [field]: value };
    onChange(next);
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next.map((img, idx) => ({ ...img, sort_order: idx })));
  }
  async function handleFile(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIdx(i);
    try {
      const url = await uploadPopupImage(file);
      update(i, 'image_url', url);
    } catch {
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setUploadingIdx(null);
      if (fileRefs.current[i]) fileRefs.current[i]!.value = '';
    }
  }

  return (
    <div className="space-y-2">
      {images.map((img, i) => (
        <div key={i} className="flex gap-2 items-start rounded-lg border bg-gray-50 p-3">
          <div className="flex flex-col gap-0.5 shrink-0">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
              className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30">
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <GripVertical className="h-3.5 w-3.5 text-gray-300 mx-auto" />
            <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1}
              className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 space-y-1.5">
            {/* 이미지 업로드 */}
            <div className="flex items-center gap-2">
              {img.image_url ? (
                <div className="relative shrink-0">
                  <img src={img.image_url} alt="" className="h-14 w-20 rounded border object-cover" />
                  <button type="button" onClick={() => update(i, 'image_url', '')}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ) : (
                <button type="button"
                  onClick={() => fileRefs.current[i]?.click()}
                  disabled={uploadingIdx === i}
                  className="flex h-14 w-20 shrink-0 items-center justify-center rounded border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed"
                >
                  {uploadingIdx === i
                    ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                    : <ImageIcon className="h-5 w-5 text-gray-400" />
                  }
                </button>
              )}
              <input ref={(el) => { fileRefs.current[i] = el; }} type="file" accept="image/*"
                className="hidden" onChange={(e) => handleFile(i, e)} />
              <div className="flex-1 space-y-1">
                <input placeholder="링크 URL (클릭 시 이동)" value={img.link_url}
                  onChange={(e) => update(i, 'link_url', e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input placeholder="캡션 (선택)" value={img.caption}
                  onChange={(e) => update(i, 'caption', e.target.value)}
                  className="w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
          <button type="button" onClick={() => remove(i)}
            className="shrink-0 p-1 text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add} className="w-full">
        <Plus className="h-3.5 w-3.5 mr-1" /> 이미지 추가
      </Button>
    </div>
  );
}

// ─── 슬라이드 설정 패널 ───────────────────────────────────────────────────────

function SlideSettingsPanel({
  settings, onChange,
}: {
  settings: SlideSettings;
  onChange: (s: SlideSettings) => void;
}) {
  function set<K extends keyof SlideSettings>(key: K, val: SlideSettings[K]) {
    onChange({ ...settings, [key]: val });
  }

  return (
    <div className="rounded-lg border bg-blue-50 p-4 space-y-3">
      <p className="text-sm font-semibold text-blue-800">슬라이드 설정</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={settings.autoplay}
            onChange={(e) => set('autoplay', e.target.checked)} className="rounded" />
          자동 재생
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={settings.loop}
            onChange={(e) => set('loop', e.target.checked)} className="rounded" />
          루프
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={settings.navigation}
            onChange={(e) => set('navigation', e.target.checked)} className="rounded" />
          이전/다음 버튼
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={settings.pagination}
            onChange={(e) => set('pagination', e.target.checked)} className="rounded" />
          페이지 점
        </label>
      </div>
      {settings.autoplay && (
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-600 shrink-0">재생 간격</label>
          <input type="number" min={500} step={500} value={settings.autoplayDelay}
            onChange={(e) => set('autoplayDelay', parseInt(e.target.value) || 3000)}
            className="w-24 rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-gray-400">ms</span>
        </div>
      )}
      <div className="flex items-center gap-2 text-sm">
        <label className="text-gray-600 shrink-0">전환 효과</label>
        <select value={settings.effect} onChange={(e) => set('effect', e.target.value as 'slide' | 'fade')}
          className="rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="slide">슬라이드</option>
          <option value="fade">페이드</option>
        </select>
      </div>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function AdminPopupsPage() {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('sort_order');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PopupForm>(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadPopups(); }, [sortKey]);

  async function loadPopups() {
    const supabase = createClient();
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('popups')
        .select('*, popup_images(id, image_url, link_url, caption, sort_order)')
        .order(sortKey, { ascending: sortKey === 'name' });
      if (error) throw error;
      setPopups((data || []).map((p: any) => ({
        id: p.id, name: p.name,
        popupType: (p.popup_type || 'image') as PopupType,
        content: p.content || '',
        imageUrl: p.image_url || '',
        linkUrl: p.link_url || '',
        slideSettings: p.slide_settings || { ...DEFAULT_SLIDE_SETTINGS },
        images: (p.popup_images || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
        position: (p.position || 'center') as PositionPreset,
        positionX: p.position_x ?? 50,
        positionY: p.position_y ?? 50,
        width: p.width || 500,
        startsAt: p.starts_at, endsAt: p.ends_at,
        isActive: p.is_active, showTodayClose: p.show_today_close,
        sortOrder: p.sort_order || 0,
        createdAt: p.created_at,
      })));
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setShowModal(true);
  }

  function openEdit(p: Popup) {
    setEditingId(p.id);
    setForm({
      name: p.name, popupType: p.popupType,
      content: p.content, imageUrl: p.imageUrl, linkUrl: p.linkUrl,
      slideSettings: { ...p.slideSettings },
      images: p.images.map((img) => ({ ...img })),
      position: p.position,
      positionX: p.positionX, positionY: p.positionY,
      width: String(p.width),
      startsAt: p.startsAt ? p.startsAt.slice(0, 16) : '',
      endsAt: p.endsAt ? p.endsAt.slice(0, 16) : '',
      isActive: p.isActive, showTodayClose: p.showTodayClose,
      sortOrder: String(p.sortOrder),
    });
    setShowModal(true);
  }

  function setF<K extends keyof PopupForm>(key: K, val: PopupForm[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return alert('팝업명을 입력하세요.');
    setSubmitting(true);
    const supabase = createClient();
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        popup_type: form.popupType,
        content: form.content || null,
        image_url: form.imageUrl || null,
        link_url: form.linkUrl || null,
        slide_settings: form.popupType === 'slide' ? form.slideSettings : null,
        position: form.position,
        position_x: form.position === 'custom' ? form.positionX : null,
        position_y: form.position === 'custom' ? form.positionY : null,
        width: parseInt(form.width) || 500,
        starts_at: form.startsAt || null,
        ends_at: form.endsAt || null,
        is_active: form.isActive,
        show_today_close: form.showTodayClose,
        sort_order: parseInt(form.sortOrder) || 0,
      };

      let popupId = editingId;
      if (editingId) {
        const { error } = await supabase.from('popups').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('popups').insert(payload).select('id').single();
        if (error) throw error;
        popupId = data.id;
      }

      // 슬라이드 이미지 동기화
      if (form.popupType === 'slide' && popupId) {
        await supabase.from('popup_images').delete().eq('popup_id', popupId);
        if (form.images.length > 0) {
          await supabase.from('popup_images').insert(
            form.images.map((img, i) => ({
              popup_id: popupId,
              image_url: img.image_url,
              link_url: img.link_url || null,
              caption: img.caption || null,
              sort_order: i,
            }))
          );
        }
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

  async function handleToggle(id: string, current: boolean) {
    const supabase = createClient();
    await supabase.from('popups').update({ is_active: !current }).eq('id', id);
    await loadPopups();
  }

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'sort_order', label: '등록순' },
    { key: 'created_at', label: '최신순' },
    { key: 'name',       label: '이름순' },
  ];

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">팝업 관리</h1>
          <p className="text-sm text-gray-500 mt-1">텍스트·이미지·슬라이드 팝업을 관리합니다.</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />팝업 추가</Button>
      </div>

      {/* 필터 */}
      <div className="mb-4 flex gap-2">
        {SORT_OPTIONS.map((o) => (
          <button key={o.key}
            onClick={() => setSortKey(o.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              sortKey === o.key
                ? 'bg-gray-900 text-white'
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />)}
        </div>
      ) : popups.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="mb-4 text-gray-400">등록된 팝업이 없습니다.</p>
          <Button onClick={openCreate}>팝업 추가하기</Button>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">팝업명</th>
                  <th className="px-4 py-3 text-left">타입</th>
                  <th className="px-4 py-3 text-left">위치</th>
                  <th className="px-4 py-3 text-left">노출 기간</th>
                  <th className="px-4 py-3 text-left">상태</th>
                  <th className="px-4 py-3 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {popups.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{TYPE_LABELS[p.popupType]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {p.position === 'custom'
                        ? `직접설정 (${p.positionX}%, ${p.positionY}%)`
                        : PRESET_POSITIONS.find((pp) => pp.value === p.position)?.label || p.position}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.startsAt ? format(new Date(p.startsAt), 'yyyy.MM.dd HH:mm') : '즉시'} ~{' '}
                      {p.endsAt ? format(new Date(p.endsAt), 'yyyy.MM.dd HH:mm') : '무기한'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={p.isActive ? 'default' : 'secondary'}>
                        {p.isActive ? '활성' : '비활성'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleToggle(p.id, p.isActive)}>
                          {p.isActive ? '비활성화' : '활성화'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
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

      {/* 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingId ? '팝업 수정' : '팝업 추가'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 팝업명 */}
              <div>
                <label className="mb-1 block text-sm font-medium">팝업명 *</label>
                <input value={form.name} onChange={(e) => setF('name', e.target.value)} required
                  placeholder="봄 프로모션 팝업"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* 타입 선택 */}
              <div>
                <label className="mb-2 block text-sm font-medium">팝업 타입</label>
                <div className="flex gap-2">
                  {(['text', 'image', 'slide'] as PopupType[]).map((t) => (
                    <button key={t} type="button"
                      onClick={() => setF('popupType', t)}
                      className={`flex-1 rounded-lg border-2 py-2 text-sm font-medium transition-colors ${
                        form.popupType === t
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 타입별 컨텐츠 */}
              {form.popupType === 'text' && (
                <div>
                  <label className="mb-1 block text-sm font-medium">내용 (HTML 가능)</label>
                  <textarea value={form.content} onChange={(e) => setF('content', e.target.value)}
                    rows={6} placeholder="<h2>제목</h2><p>내용을 입력하세요</p>"
                    className="w-full rounded-md border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}

              {form.popupType === 'image' && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">이미지</label>
                    <ImageUploadInput
                      value={form.imageUrl}
                      onChange={(url) => setF('imageUrl', url)}
                      placeholder="이미지 파일 선택"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">링크 URL (클릭 시 이동)</label>
                    <input value={form.linkUrl} onChange={(e) => setF('linkUrl', e.target.value)}
                      placeholder="https://..."
                      className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              )}

              {form.popupType === 'slide' && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">슬라이드 이미지 목록</label>
                    <SlideImageList images={form.images} onChange={(imgs) => setF('images', imgs)} />
                  </div>
                  <SlideSettingsPanel settings={form.slideSettings}
                    onChange={(s) => setF('slideSettings', s)} />
                </div>
              )}

              {/* 위치 설정 */}
              <div>
                <label className="mb-1 block text-sm font-medium">표시 위치</label>
                <select value={form.position} onChange={(e) => setF('position', e.target.value as PositionPreset)}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="center">중앙</option>
                  <option value="top">상단</option>
                  <option value="bottom">하단</option>
                  <option value="left">좌측</option>
                  <option value="right">우측</option>
                  <option value="custom">직접 설정 (X/Y 좌표)</option>
                </select>
                {form.position === 'custom' && (
                  <div className="flex items-center gap-3 mt-2">
                    <label className="text-sm text-gray-600 w-4">X</label>
                    <input type="number" min={0} max={100} step={0.1} value={form.positionX}
                      onChange={(e) => setForm((p) => ({ ...p, positionX: parseFloat(e.target.value) || 0 }))}
                      className="w-24 rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <span className="text-sm text-gray-400">%</span>
                    <label className="text-sm text-gray-600 w-4 ml-2">Y</label>
                    <input type="number" min={0} max={100} step={0.1} value={form.positionY}
                      onChange={(e) => setForm((p) => ({ ...p, positionY: parseFloat(e.target.value) || 0 }))}
                      className="w-24 rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <span className="text-sm text-gray-400">%</span>
                  </div>
                )}
              </div>

              {/* 크기 */}
              <div>
                <label className="mb-1 block text-sm font-medium">팝업 너비 (px)</label>
                <input type="number" min={200} max={1200} value={form.width}
                  onChange={(e) => setF('width', e.target.value)}
                  className="w-32 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* 노출 기간 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">노출 시작일</label>
                  <input type="datetime-local" value={form.startsAt}
                    onChange={(e) => setF('startsAt', e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="mt-0.5 text-xs text-gray-400">비워두면 즉시 노출</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">노출 종료일</label>
                  <input type="datetime-local" value={form.endsAt}
                    onChange={(e) => setF('endsAt', e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="mt-0.5 text-xs text-gray-400">비워두면 무기한 노출</p>
                </div>
              </div>

              {/* 옵션 체크박스 */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={form.showTodayClose}
                    onChange={(e) => setF('showTodayClose', e.target.checked)} className="rounded" />
                  "오늘 하루 보지 않기" 버튼 표시
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={form.isActive}
                    onChange={(e) => setF('isActive', e.target.checked)} className="rounded" />
                  즉시 활성화
                </label>
              </div>

              {/* 정렬 순서 */}
              <div>
                <label className="mb-1 block text-sm font-medium">정렬 순서</label>
                <input type="number" value={form.sortOrder}
                  onChange={(e) => setF('sortOrder', e.target.value)}
                  className="w-24 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

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
