import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Package, CheckCircle, Trash2, Download, Key, X, ShoppingCart, Star, Plus, Settings, Upload, Palette, LayoutGrid } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getStoreThemes } from '@/services/store';
import { uploadThemeCSS, uploadThemeThumbnail, deleteThemeFiles, downloadAndInstallTheme } from '@/services/theme-storage';

interface Theme {
  id: string;
  slug: string;
  name: string;
  version: string;
  description?: string;
  isActive: boolean;
  installedAt: string;
  cssUrl?: string;
  thumbnailUrl?: string;
  config?: ThemeConfig;
  source: string;
}

interface ThemeConfig {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  headerStyle?: 'fixed' | 'static';
  layoutType?: 'wide' | 'boxed';
  fontFamily?: string;
}

interface AvailableTheme {
  id: string;
  name: string;
  slug: string;
  version: string;
  description?: string;
  thumbnail?: string;
  price: number;
  isPremium: boolean;
  reviewAvg?: number;
  reviewCount?: number;
}

const defaultConfig: ThemeConfig = {
  primaryColor: '#3B82F6',
  secondaryColor: '#10B981',
  backgroundColor: '#FFFFFF',
  textColor: '#1F2937',
  headerStyle: 'fixed',
  layoutType: 'wide',
  fontFamily: 'Pretendard, sans-serif',
};

const STORE_API_URL = import.meta.env.VITE_STORE_API_URL || 'http://localhost:3001';

export default function AdminThemesPage() {
  const [activeTab, setActiveTab] = useState<'installed' | 'available' | 'create'>('installed');
  const [themes, setThemes] = useState<Theme[]>([]);
  const [available, setAvailable] = useState<AvailableTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  // 스토어 설치 모달
  const [licenseModal, setLicenseModal] = useState<{ themeId: string; themeName: string; themeSlug: string } | null>(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [installLoading, setInstallLoading] = useState(false);

  // 커스텀 테마 생성
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    version: '1.0.0',
    description: '',
    config: { ...defaultConfig },
    customCSS: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 테마 설정 모달
  const [configModal, setConfigModal] = useState<Theme | null>(null);
  const [editConfig, setEditConfig] = useState<ThemeConfig>({ ...defaultConfig });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => {
    loadThemes();
  }, []);

  async function loadThemes() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('installed_themes')
        .select('id, slug, name, version, description, is_active, installed_at, css_url, thumbnail_url, config, source')
        .order('installed_at', { ascending: false });

      if (error) throw error;
      setThemes(
        (data || []).map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          version: t.version,
          description: t.description,
          isActive: t.is_active,
          installedAt: t.installed_at,
          cssUrl: t.css_url,
          thumbnailUrl: t.thumbnail_url,
          config: t.config,
          source: t.source,
        }))
      );
    } catch {
      setThemes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'available' && available.length === 0) {
      loadAvailableThemes();
    }
  }, [activeTab]);

  async function loadAvailableThemes() {
    setAvailableLoading(true);
    try {
      const result = await getStoreThemes({ limit: 50 });
      if (result.success && result.data) {
        setAvailable(
          result.data.map((t) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            version: t.version || '1.0.0',
            description: t.description,
            thumbnail: t.thumbnail,
            price: t.price,
            isPremium: t.isPremium,
            reviewAvg: t.reviewAvg,
            reviewCount: t.reviewCount,
          }))
        );
      }
    } catch (err) {
      console.error('테마 스토어 로딩 실패:', err);
    } finally {
      setAvailableLoading(false);
    }
  }

  async function activateTheme(id: string) {
    setActionLoading(id + '-activate');
    try {
      const supabase = createClient();
      await supabase.from('installed_themes').update({ is_active: false }).neq('id', '');
      const { error } = await supabase
        .from('installed_themes')
        .update({ is_active: true, activated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      setThemes((prev) => prev.map((t) => ({ ...t, isActive: t.id === id })));
      showToast('테마가 활성화되었습니다. 페이지를 새로고침하면 적용됩니다.');
    } catch {
      showToast('활성화에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteTheme(theme: Theme) {
    if (!confirm('이 테마를 삭제하시겠습니까? Storage의 파일도 함께 삭제됩니다.')) return;
    setActionLoading(theme.id + '-delete');
    try {
      // Storage 파일 삭제
      await deleteThemeFiles(theme.slug);

      const supabase = createClient();
      const { error } = await supabase.from('installed_themes').delete().eq('id', theme.id);
      if (error) throw error;
      setThemes((prev) => prev.filter((t) => t.id !== theme.id));
      showToast('테마가 삭제되었습니다.');
    } catch {
      showToast('삭제에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  }

  // 스토어에서 테마 설치
  async function installFromStore() {
    if (!licenseModal) return;
    setInstallLoading(true);
    try {
      // freecart-web에서 테마 다운로드 후 Storage에 업로드
      const downloadResult = await downloadAndInstallTheme(
        STORE_API_URL,
        licenseModal.themeId,
        licenseModal.themeSlug,
        licenseKey || undefined
      );

      const supabase = createClient();
      const { error } = await supabase.from('installed_themes').insert({
        slug: licenseModal.themeSlug,
        name: licenseModal.themeName,
        version: '1.0.0',
        source: 'store',
        license_key: licenseKey || null,
        css_url: downloadResult.cssUrl || null,
        is_active: false,
      });

      if (error) throw error;
      showToast('테마가 설치되었습니다.');
      setLicenseModal(null);
      setLicenseKey('');
      await loadThemes();
    } catch (err) {
      console.error('테마 설치 실패:', err);
      showToast('설치에 실패했습니다.');
    } finally {
      setInstallLoading(false);
    }
  }

  // 커스텀 테마 생성
  async function createCustomTheme() {
    if (!createForm.name.trim() || !createForm.slug.trim()) {
      showToast('테마명과 슬러그는 필수입니다.');
      return;
    }

    setCreateLoading(true);
    try {
      let cssUrl: string | null = null;
      let thumbnailUrl: string | null = null;

      // CSS 업로드
      if (createForm.customCSS.trim()) {
        const cssResult = await uploadThemeCSS(createForm.slug, createForm.customCSS);
        if (!cssResult.success) throw new Error(cssResult.error);
        cssUrl = cssResult.url || null;
      }

      // 썸네일 업로드
      if (thumbnailFile) {
        const thumbResult = await uploadThemeThumbnail(createForm.slug, thumbnailFile);
        if (!thumbResult.success) throw new Error(thumbResult.error);
        thumbnailUrl = thumbResult.url || null;
      }

      const supabase = createClient();
      const { error } = await supabase.from('installed_themes').insert({
        slug: createForm.slug,
        name: createForm.name,
        version: createForm.version || '1.0.0',
        description: createForm.description || null,
        source: 'custom',
        css_url: cssUrl,
        thumbnail_url: thumbnailUrl,
        config: createForm.config,
        is_active: false,
      });

      if (error) throw error;

      showToast('테마가 생성되었습니다.');
      setCreateForm({
        name: '',
        slug: '',
        version: '1.0.0',
        description: '',
        config: { ...defaultConfig },
        customCSS: '',
      });
      setThumbnailFile(null);
      setActiveTab('installed');
      await loadThemes();
    } catch (err) {
      console.error('테마 생성 실패:', err);
      showToast('생성에 실패했습니다.');
    } finally {
      setCreateLoading(false);
    }
  }

  // 테마 설정 저장
  async function saveThemeConfig() {
    if (!configModal) return;
    setActionLoading(configModal.id + '-config');
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('installed_themes')
        .update({ config: editConfig })
        .eq('id', configModal.id);

      if (error) throw error;

      setThemes((prev) =>
        prev.map((t) => (t.id === configModal.id ? { ...t, config: editConfig } : t))
      );
      showToast('설정이 저장되었습니다.');
      setConfigModal(null);
    } catch {
      showToast('저장에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* 스토어 설치 모달 */}
      {licenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">테마 설치 - {licenseModal.themeName}</h3>
              <button onClick={() => setLicenseModal(null)}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              테마 파일이 Supabase Storage에 저장됩니다.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Key className="h-4 w-4 inline mr-1" />
                라이선스 키 (유료 테마인 경우)
              </label>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="라이선스 키를 입력하세요"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setLicenseModal(null)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">취소</button>
              <button onClick={installFromStore} disabled={installLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                {installLoading ? '설치 중...' : '설치'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 테마 설정 모달 */}
      {configModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">테마 설정 - {configModal.name}</h3>
              <button onClick={() => setConfigModal(null)}>
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                  <input
                    type="color"
                    value={editConfig.primaryColor || '#3B82F6'}
                    onChange={(e) => setEditConfig({ ...editConfig, primaryColor: e.target.value })}
                    className="w-full h-10 rounded border cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                  <input
                    type="color"
                    value={editConfig.secondaryColor || '#10B981'}
                    onChange={(e) => setEditConfig({ ...editConfig, secondaryColor: e.target.value })}
                    className="w-full h-10 rounded border cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
                  <input
                    type="color"
                    value={editConfig.backgroundColor || '#FFFFFF'}
                    onChange={(e) => setEditConfig({ ...editConfig, backgroundColor: e.target.value })}
                    className="w-full h-10 rounded border cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Text Color</label>
                  <input
                    type="color"
                    value={editConfig.textColor || '#1F2937'}
                    onChange={(e) => setEditConfig({ ...editConfig, textColor: e.target.value })}
                    className="w-full h-10 rounded border cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">헤더 스타일</label>
                <select
                  value={editConfig.headerStyle || 'fixed'}
                  onChange={(e) => setEditConfig({ ...editConfig, headerStyle: e.target.value as 'fixed' | 'static' })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="fixed">고정 (Fixed)</option>
                  <option value="static">일반 (Static)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">레이아웃</label>
                <select
                  value={editConfig.layoutType || 'wide'}
                  onChange={(e) => setEditConfig({ ...editConfig, layoutType: e.target.value as 'wide' | 'boxed' })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="wide">와이드 (Wide)</option>
                  <option value="boxed">박스형 (Boxed)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">폰트</label>
                <input
                  type="text"
                  value={editConfig.fontFamily || ''}
                  onChange={(e) => setEditConfig({ ...editConfig, fontFamily: e.target.value })}
                  placeholder="Pretendard, sans-serif"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfigModal(null)} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50">취소</button>
              <button
                onClick={saveThemeConfig}
                disabled={actionLoading === configModal.id + '-config'}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
              >
                {actionLoading === configModal.id + '-config' ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Palette className="h-7 w-7 text-blue-600" />
            테마 관리
          </h1>
          <p className="text-gray-500 text-sm mt-1">쇼핑몰 테마를 설치하고 관리합니다. CSS는 Supabase Storage에 저장됩니다.</p>
        </div>
        <Link
          to="/admin/themes/layout-editor"
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <LayoutGrid className="h-4 w-4" />
          레이아웃 에디터
        </Link>
      </div>

      <div className="flex border-b mb-6">
        {(['installed', 'available', 'create'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'installed' ? '설치된 테마' : tab === 'available' ? '테마 스토어' : '+ 직접 만들기'}
          </button>
        ))}
      </div>

      {/* 설치된 테마 */}
      {activeTab === 'installed' && (
        <div>
          {loading ? (
            <div className="flex justify-center py-12">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : themes.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="mb-4">설치된 테마가 없습니다.</p>
              <button
                onClick={() => setActiveTab('create')}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                + 직접 만들기
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {themes.map((theme) => (
                <div key={theme.id} className={`border rounded-xl overflow-hidden bg-white ${theme.isActive ? 'ring-2 ring-blue-500' : ''}`}>
                  <div className="aspect-video bg-gray-100 relative">
                    {theme.thumbnailUrl ? (
                      <img src={theme.thumbnailUrl} alt={theme.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-300">
                        <Package className="h-12 w-12" />
                      </div>
                    )}
                    {theme.isActive && (
                      <span className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> 활성
                      </span>
                    )}
                    <span className="absolute top-2 right-2 bg-gray-800/70 text-white text-xs px-2 py-1 rounded">
                      {theme.source === 'store' ? '스토어' : theme.source === 'custom' ? '직접 제작' : '기본'}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900">{theme.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">v{theme.version} · {theme.slug}</p>
                    {theme.description && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{theme.description}</p>
                    )}
                    <div className="mt-4 flex gap-2">
                      {!theme.isActive && (
                        <button
                          onClick={() => activateTheme(theme.id)}
                          disabled={actionLoading === theme.id + '-activate'}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 rounded-lg disabled:opacity-50"
                        >
                          {actionLoading === theme.id + '-activate' ? '처리 중...' : '활성화'}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setConfigModal(theme);
                          setEditConfig(theme.config || { ...defaultConfig });
                        }}
                        className="p-2 border rounded-lg hover:bg-gray-50"
                        title="설정"
                      >
                        <Settings className="h-4 w-4 text-gray-600" />
                      </button>
                      {!theme.isActive && (
                        <button
                          onClick={() => deleteTheme(theme)}
                          disabled={actionLoading === theme.id + '-delete'}
                          className="p-2 border rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-50"
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 테마 스토어 */}
      {activeTab === 'available' && (
        <div>
          {availableLoading ? (
            <div className="flex justify-center py-12">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : available.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="mb-2">테마 스토어에 연결할 수 없거나 등록된 테마가 없습니다.</p>
              <p className="text-xs">
                freecart-web 서버가 실행 중인지 확인하세요.
                <br />
                환경변수 <code className="bg-gray-100 px-1 rounded">VITE_STORE_API_URL</code>을 설정하세요.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {available.map((theme) => (
                <div key={theme.id} className="border rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow">
                  <div className="aspect-video bg-gray-100 relative">
                    {theme.thumbnail ? (
                      <img src={theme.thumbnail} alt={theme.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-300"><Package className="h-12 w-12" /></div>
                    )}
                    {theme.isPremium && (
                      <span className="absolute top-2 right-2 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded">
                        PREMIUM
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{theme.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">v{theme.version}</p>
                      </div>
                      <div className="text-right">
                        {theme.price === 0 ? (
                          <span className="text-green-600 font-bold text-sm">무료</span>
                        ) : (
                          <span className="text-blue-600 font-bold text-sm">{theme.price.toLocaleString()}원</span>
                        )}
                      </div>
                    </div>
                    {theme.description && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{theme.description}</p>}
                    {(theme.reviewAvg !== undefined && theme.reviewCount !== undefined && theme.reviewCount > 0) && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span>{theme.reviewAvg.toFixed(1)}</span>
                        <span>({theme.reviewCount})</span>
                      </div>
                    )}
                    <button
                      onClick={() => setLicenseModal({ themeId: theme.id, themeName: theme.name, themeSlug: theme.slug })}
                      className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      {theme.price === 0 ? (
                        <><Download className="h-4 w-4" />무료 설치</>
                      ) : (
                        <><ShoppingCart className="h-4 w-4" />구매 후 설치</>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 직접 만들기 */}
      {activeTab === 'create' && (
        <div className="max-w-2xl">
          <div className="bg-white border rounded-xl p-6">
            <h2 className="font-bold text-lg mb-4">커스텀 테마 만들기</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">테마명 *</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="나만의 테마"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">슬러그 *</label>
                  <input
                    type="text"
                    value={createForm.slug}
                    onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="my-custom-theme"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <input
                  type="text"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="테마에 대한 설명"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">썸네일 이미지</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 border rounded-lg px-4 py-2 text-sm hover:bg-gray-50"
                >
                  <Upload className="h-4 w-4" />
                  {thumbnailFile ? thumbnailFile.name : '이미지 선택'}
                </button>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium text-sm text-gray-700 mb-3">색상 설정</h3>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Primary</label>
                    <input
                      type="color"
                      value={createForm.config.primaryColor}
                      onChange={(e) => setCreateForm({
                        ...createForm,
                        config: { ...createForm.config, primaryColor: e.target.value }
                      })}
                      className="w-full h-8 rounded border cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Secondary</label>
                    <input
                      type="color"
                      value={createForm.config.secondaryColor}
                      onChange={(e) => setCreateForm({
                        ...createForm,
                        config: { ...createForm.config, secondaryColor: e.target.value }
                      })}
                      className="w-full h-8 rounded border cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Background</label>
                    <input
                      type="color"
                      value={createForm.config.backgroundColor}
                      onChange={(e) => setCreateForm({
                        ...createForm,
                        config: { ...createForm.config, backgroundColor: e.target.value }
                      })}
                      className="w-full h-8 rounded border cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Text</label>
                    <input
                      type="color"
                      value={createForm.config.textColor}
                      onChange={(e) => setCreateForm({
                        ...createForm,
                        config: { ...createForm.config, textColor: e.target.value }
                      })}
                      className="w-full h-8 rounded border cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">커스텀 CSS</label>
                <textarea
                  value={createForm.customCSS}
                  onChange={(e) => setCreateForm({ ...createForm, customCSS: e.target.value })}
                  placeholder={`:root {
  --theme-primary: #3B82F6;
}

.header {
  /* 커스텀 스타일 */
}`}
                  rows={10}
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">CSS가 Supabase Storage에 저장됩니다.</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setActiveTab('installed')}
                  className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={createCustomTheme}
                  disabled={createLoading || !createForm.name || !createForm.slug}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
                >
                  {createLoading ? '생성 중...' : '테마 생성'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
