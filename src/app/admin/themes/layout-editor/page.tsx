/**
 * 레이아웃 에디터 페이지
 * 활성 테마의 layout_config를 DB에서 로드하고 저장합니다.
 */

import { useState, useEffect, useRef, Suspense } from 'react';
import { Check, Eye, Save, RotateCcw, AlertCircle, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { createClient } from '@/lib/supabase/client';
import { uploadThemeThumbnail } from '@/services/theme-storage';
import {
  COMPONENT_META,
  DEFAULT_LAYOUT_CONFIG,
  type ThemeLayoutConfig,
} from '@/lib/theme';

const PreviewPanel = () => import('./preview-panel').then((m) => ({ default: m.default }));
const LazyPreview = ({ config }: { config: ThemeLayoutConfig }) => {
  const [Panel, setPanel] = useState<React.ComponentType<{ config: ThemeLayoutConfig }> | null>(null);
  useEffect(() => { PreviewPanel().then((m) => setPanel(() => m.default)); }, []);
  if (!Panel) return <div className="p-4 text-center text-gray-400 text-sm">로딩 중...</div>;
  return <Panel config={config} />;
};

type ComponentCategory = 'headers' | 'footers' | 'productCards' | 'productGrids';

export default function LayoutEditorPage() {
  const [config, setConfig] = useState<ThemeLayoutConfig>(DEFAULT_LAYOUT_CONFIG);
  const [activeCategory, setActiveCategory] = useState<ComponentCategory>('headers');
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [activeThemeName, setActiveThemeName] = useState<string>('');
  const [activeThemeSlug, setActiveThemeSlug] = useState<string>('');
  const [toast, setToast] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  // ------------------------------------------------------------------
  // 활성 테마 config 로드
  // ------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('installed_themes')
          .select('id, name, slug, layout_config')
          .eq('is_active', true)
          .maybeSingle();

        if (data) {
          setActiveThemeId(data.id);
          setActiveThemeName(data.name);
          setActiveThemeSlug(data.slug);
          if (data.layout_config && Object.keys(data.layout_config).length > 0) {
            setConfig({
              ...DEFAULT_LAYOUT_CONFIG,
              ...data.layout_config,
              settings: { ...DEFAULT_LAYOUT_CONFIG.settings, ...data.layout_config.settings },
            });
          }
        }
      } catch (err) {
        console.error('layout config 로드 실패:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const categories: { id: ComponentCategory; label: string }[] = [
    { id: 'headers', label: '헤더' },
    { id: 'footers', label: '푸터' },
    { id: 'productCards', label: '상품 카드' },
    { id: 'productGrids', label: '상품 그리드' },
  ];

  function getOptions(category: ComponentCategory) {
    return COMPONENT_META[category] as { id: string; name: string; description: string }[];
  }

  function getSelectedValue(category: ComponentCategory): string | null {
    const map: Record<ComponentCategory, keyof ThemeLayoutConfig> = {
      headers: 'header', footers: 'footer',
      productCards: 'productCard', productGrids: 'productGrid',
    };
    return config[map[category]] as string | null;
  }

  function handleSelect(category: ComponentCategory, value: string | null) {
    const map: Record<ComponentCategory, keyof ThemeLayoutConfig> = {
      headers: 'header', footers: 'footer',
      productCards: 'productCard', productGrids: 'productGrid',
    };
    setConfig({ ...config, [map[category]]: value });
  }

  // ------------------------------------------------------------------
  // DB에 저장
  // ------------------------------------------------------------------
  async function handleSave() {
    if (!activeThemeId) {
      showToast('활성화된 테마가 없습니다. 먼저 테마를 활성화하세요.');
      return;
    }
    setIsSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('installed_themes')
        .update({ layout_config: config })
        .eq('id', activeThemeId);
      if (error) throw error;
      showToast('레이아웃 설정이 저장되었습니다. 페이지 새로고침 시 적용됩니다.');
    } catch {
      showToast('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleReset() {
    if (confirm('기본 설정으로 초기화하시겠습니까?')) {
      setConfig(DEFAULT_LAYOUT_CONFIG);
    }
  }

  // ------------------------------------------------------------------
  // 썸네일 자동 캡처
  // ------------------------------------------------------------------
  async function handleCaptureThumbnail() {
    if (!previewRef.current) {
      showToast('미리보기를 먼저 열어주세요.');
      return;
    }
    if (!activeThemeId || !activeThemeSlug) {
      showToast('활성화된 테마가 없습니다.');
      return;
    }
    setIsCapturing(true);
    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 0.5,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
      });

      // canvas → Blob
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('캡처 실패'))), 'image/png')
      );

      // Supabase Storage 업로드
      const file = new File([blob], 'thumbnail.png', { type: 'image/png' });
      const result = await uploadThemeThumbnail(activeThemeSlug, file);
      if (!result.success) throw new Error(result.error);

      // DB thumbnail_url 업데이트
      const supabase = createClient();
      await supabase.from('installed_themes')
        .update({ thumbnail_url: result.url })
        .eq('id', activeThemeId);

      showToast('썸네일이 저장되었습니다!');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '썸네일 생성 실패');
    } finally {
      setIsCapturing(false);
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400">로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm">
          {toast}
        </div>
      )}

      {/* 헤더 */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">레이아웃 에디터</h1>
            {activeThemeName ? (
              <p className="text-sm text-blue-600">
                적용 테마: <span className="font-medium">{activeThemeName}</span>
              </p>
            ) : (
              <p className="text-sm text-orange-500 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                활성화된 테마 없음 —{' '}
                <Link to="/admin/themes" className="underline">테마 설정으로 이동</Link>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 text-sm transition-colors ${
                showPreview ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Eye className="h-4 w-4" /> 미리보기
            </button>
            {showPreview && (
              <button
                onClick={handleCaptureThumbnail}
                disabled={isCapturing || !activeThemeId}
                title="미리보기를 캡처하여 테마 썸네일로 저장"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Camera className="h-4 w-4" />
                {isCapturing ? '캡처 중...' : '썸네일 생성'}
              </button>
            )}
            <button onClick={handleReset}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-200 flex items-center gap-2">
              <RotateCcw className="h-4 w-4" /> 초기화
            </button>
            <button onClick={handleSave} disabled={isSaving || !activeThemeId}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2">
              <Save className="h-4 w-4" /> {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* 사이드바 */}
          <aside className="w-48 flex-shrink-0">
            <nav className="sticky top-24 space-y-1">
              {categories.map((cat) => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className={`w-full px-4 py-3 text-left rounded-lg font-medium text-sm transition-colors ${
                    activeCategory === cat.id ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}>
                  {cat.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* 메인 */}
          <main className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">
                  {categories.find((c) => c.id === activeCategory)?.label} 스타일
                </h2>
                {/* 헤더/푸터는 '없음' 선택 가능 */}
                {(activeCategory === 'headers' || activeCategory === 'footers') && (
                  <button
                    onClick={() => handleSelect(activeCategory, null)}
                    className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                      getSelectedValue(activeCategory) === null
                        ? 'border-red-400 bg-red-50 text-red-600'
                        : 'border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-400'
                    }`}
                  >
                    없음 (미표시)
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {getOptions(activeCategory).map((option) => {
                  const isSelected = getSelectedValue(activeCategory) === option.id;
                  return (
                    <button key={option.id} onClick={() => handleSelect(activeCategory, option.id)}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <div className="aspect-[16/9] bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                        <span className="text-gray-400 text-sm">{option.name}</span>
                      </div>
                      <h3 className="font-medium text-gray-900 text-sm">{option.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{option.description}</p>
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 추가 설정 */}
            <div className="bg-white rounded-xl border p-6 mt-6">
              <h2 className="text-lg font-bold text-gray-900 mb-5">추가 설정</h2>
              <div className="space-y-4">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">헤더 상단 고정</span>
                  <input type="checkbox" checked={config.settings.headerFixed}
                    onChange={(e) => setConfig({ ...config, settings: { ...config.settings, headerFixed: e.target.checked } })}
                    className="w-5 h-5 rounded border-gray-300 text-blue-500" />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">경로 표시 (Breadcrumb)</span>
                  <input type="checkbox" checked={config.settings.showBreadcrumb}
                    onChange={(e) => setConfig({ ...config, settings: { ...config.settings, showBreadcrumb: e.target.checked } })}
                    className="w-5 h-5 rounded border-gray-300 text-blue-500" />
                </label>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">상품 이미지 비율</span>
                  <select value={config.settings.productImageRatio}
                    onChange={(e) => setConfig({ ...config, settings: { ...config.settings, productImageRatio: e.target.value as '1:1' | '4:3' | '3:4' } })}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="1:1">1:1 (정사각형)</option>
                    <option value="4:3">4:3 (가로형)</option>
                    <option value="3:4">3:4 (세로형)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 현재 설정 JSON */}
            <div className="bg-gray-800 rounded-xl p-5 mt-6">
              <h3 className="text-xs font-medium text-gray-400 mb-3">현재 설정 JSON (DB 저장값)</h3>
              <pre className="text-xs text-green-400 overflow-x-auto">
                {JSON.stringify(config, null, 2)}
              </pre>
            </div>
          </main>

          {/* 미리보기 */}
          {showPreview && (
            <aside className="w-96 flex-shrink-0">
              <div className="sticky top-24 bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                  <h3 className="font-medium text-sm text-gray-900">미리보기</h3>
                  <span className="text-xs text-gray-400">50% 축소</span>
                </div>
                <div ref={previewRef} className="h-[600px] overflow-y-auto">
                  <Suspense fallback={<div className="p-4 text-center text-gray-400 text-sm">로딩 중...</div>}>
                    <LazyPreview config={config} />
                  </Suspense>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
