import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Palette, CheckCircle, Trash2, Download, X, ShoppingCart, Star, Plus,
  Upload, Package,
  Link2, Link2Off, User, RefreshCw, Pencil,
} from 'lucide-react';
import JSZip from 'jszip';
import { createClient } from '@/lib/supabase/client';
import { getStoreThemes, checkStoreConnection } from '@/services/store';
import { startOAuthFlow, getOAuthConnection, disconnectOAuth, getValidAccessToken } from '@/services/oauth';
import { uploadThemeCSS, uploadThemeFile, uploadSkinCSS, deleteThemeFiles, downloadAndInstallTheme, installThemePackage } from '@/services/theme-storage';
import type { ThemeLayoutConfig, ThemeScript } from '@/lib/theme/types';
import { DEFAULT_LAYOUT_CONFIG } from '@/lib/theme/types';

// ============================================================
// 타입
// ============================================================

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
  layoutConfig: ThemeLayoutConfig;
  customCss?: string;
  scripts: ThemeScript[];
  activeSkinSlug?: string;
  source: string;
  skins?: { slug: string; name: string; cssUrl?: string }[];
  themeSettings?: Record<string, string>;
  settingsSchema?: import('@/lib/theme/template-engine').ThemeSettingsSchema;
  sectionHtmlUrls?: Record<string, string>;
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

// ============================================================
// 유틸
// ============================================================

function rowToTheme(t: any, skins: any[] = []): Theme {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    version: t.version,
    description: t.description,
    isActive: t.is_active,
    installedAt: t.installed_at,
    cssUrl: t.css_url,
    thumbnailUrl: t.thumbnail_url,
    layoutConfig: { ...DEFAULT_LAYOUT_CONFIG, ...(t.layout_config || {}), settings: { ...DEFAULT_LAYOUT_CONFIG.settings, ...(t.layout_config?.settings || {}) } },
    customCss: t.custom_css || '',
    scripts: Array.isArray(t.scripts) ? t.scripts : [],
    activeSkinSlug: t.active_skin_slug,
    source: t.source,
    skins,
    themeSettings: t.theme_settings || {},
    settingsSchema: t.settings_schema || {},
    sectionHtmlUrls: t.section_html_urls || {},
  };
}

// ============================================================
// 메인 컴포넌트
// ============================================================

export default function AdminThemesPage() {
  const [activeTab, setActiveTab] = useState<'installed' | 'available' | 'create' | 'zip'>('installed');
  const [themes, setThemes] = useState<Theme[]>([]);
  const [available, setAvailable] = useState<AvailableTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  // 스토어 연결 상태
  const [storeStatus, setStoreStatus] = useState<{ connected: boolean; url: string; checked: boolean }>({ connected: false, url: '', checked: false });
  const [storeAccount, setStoreAccount] = useState<{ email: string } | null>(null);
  const [purchasedThemeIds, setPurchasedThemeIds] = useState<string[]>([]);
  const [oauthLoading, setOauthLoading] = useState(false);

  // 스토어 설치
  const [installModal, setInstallModal] = useState<{ themeId: string; themeName: string; themeSlug: string; price: number } | null>(null);
  const [installLoading, setInstallLoading] = useState(false);
  const [installProgress, setInstallProgress] = useState('');
  const [installError, setInstallError] = useState('');
  // 설치 단계: confirm(기본) | domain(도메인 미등록)
  const [installStep, setInstallStep] = useState<'confirm' | 'domain'>('confirm');

  // 직접 만들기
  const [createForm, setCreateForm] = useState({ name: '', slug: '', description: '', customCSS: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [cssFile, setCssFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ZIP 업로드
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipLog, setZipLog] = useState<string[]>([]);
  const zipFileRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  // ------------------------------------------------------------------
  // 데이터 로드
  // ------------------------------------------------------------------
  async function loadThemes() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('installed_themes')
        .select('*, skins(slug, name, css_url)')
        .order('installed_at', { ascending: false });

      if (error) throw error;
      setThemes((data || []).map((t) => rowToTheme(t, t.skins || [])));
    } catch {
      setThemes([]);
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------------------------------------------
  // 스토어 연결 확인 + OAuth 계정 연동
  // ------------------------------------------------------------------
  async function checkStore() {
    const [status, conn] = await Promise.all([
      checkStoreConnection(),
      getOAuthConnection(),
    ]);
    setStoreStatus({ ...status, checked: true });
    if (conn) {
      setStoreAccount({ email: conn.freecartUserEmail });
      // 구매 목록 조회
      await loadPurchases();
    }
  }

  async function loadPurchases() {
    try {
      const token = await getValidAccessToken();
      if (!token) return;
      const { getStorePurchases } = await import('@/services/store');
      const purchases = await getStorePurchases(token);
      setPurchasedThemeIds(purchases.themeIds);
    } catch { /* 구매 목록 조회 실패 시 무시 */ }
  }

  async function connectStoreOAuth() {
    setOauthLoading(true);
    try {
      const result = await startOAuthFlow();
      if (!result.success) {
        showToast(result.error || 'OAuth 연동에 실패했습니다.');
        return;
      }
      setStoreAccount({ email: result.email || '' });
      await loadPurchases();
      showToast('스토어 계정이 연동되었습니다.');
    } finally {
      setOauthLoading(false);
    }
  }

  async function disconnectStoreAccount() {
    await disconnectOAuth();
    setStoreAccount(null);
    setPurchasedThemeIds([]);
    showToast('계정 연동이 해제되었습니다.');
  }

  async function loadAvailableThemes() {
    setAvailableLoading(true);
    try {
      const result = await getStoreThemes({ limit: 50 });
      if (result.success && result.data) {
        setAvailable(result.data.map((t) => ({
          id: t.id, name: t.name, slug: t.slug, version: t.version || '1.0.0',
          description: t.description, thumbnail: t.thumbnail,
          price: t.price, isPremium: t.isPremium,
          reviewAvg: t.reviewAvg, reviewCount: t.reviewCount,
        })));
      }
    } catch (err) {
      console.error('테마 스토어 로딩 실패:', err);
    } finally {
      setAvailableLoading(false);
    }
  }

  useEffect(() => { loadThemes(); checkStore(); }, []);
  useEffect(() => {
    if (activeTab === 'available' && available.length === 0) loadAvailableThemes();
  }, [activeTab]);

  // ------------------------------------------------------------------
  // 테마 활성화 (단일 보장)
  // ------------------------------------------------------------------
  async function activateTheme(id: string) {
    setActionLoading(id + '-activate');
    try {
      const supabase = createClient();
      // 1. 모든 테마 비활성화
      await supabase.from('installed_themes').update({ is_active: false }).eq('is_active', true);
      // 2. 선택 테마 활성화
      const { error } = await supabase.from('installed_themes')
        .update({ is_active: true, activated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setThemes((prev) => prev.map((t) => ({ ...t, isActive: t.id === id })));
      showToast('테마가 활성화되었습니다.');
    } catch {
      showToast('활성화에 실패했습니다.');
    } finally {
      setActionLoading(null);
    }
  }

  // ------------------------------------------------------------------
  // 스킨 변경
  // ------------------------------------------------------------------
  async function activateSkin(themeId: string, skinSlug: string) {
    const supabase = createClient();
    const { error } = await supabase.from('installed_themes')
      .update({ active_skin_slug: skinSlug })
      .eq('id', themeId);
    if (error) { showToast('스킨 변경 실패'); return; }
    setThemes((prev) => prev.map((t) => t.id === themeId ? { ...t, activeSkinSlug: skinSlug } : t));
    showToast('스킨이 변경되었습니다.');
  }

  // ------------------------------------------------------------------
  // 테마 삭제
  // ------------------------------------------------------------------
  async function deleteTheme(theme: Theme) {
    if (!confirm('이 테마를 삭제하시겠습니까?')) return;
    setActionLoading(theme.id + '-delete');
    try {
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

  // ------------------------------------------------------------------
  // 커스텀 테마 생성
  // ------------------------------------------------------------------
  async function createTheme() {
    if (!createForm.name.trim() || !createForm.slug.trim()) {
      showToast('테마명과 슬러그는 필수입니다.');
      return;
    }
    setCreateLoading(true);
    try {
      const supabase = createClient();
      let cssUrl: string | null = null;

      if (cssFile) {
        const cssText = await cssFile.text();
        const result = await uploadThemeCSS(createForm.slug, cssText);
        cssUrl = result.url ?? null;
      }

      const { error } = await supabase.from('installed_themes').insert({
        slug: createForm.slug.trim(),
        name: createForm.name.trim(),
        version: '1.0.0',
        description: createForm.description || null,
        source: 'custom',
        css_url: cssUrl,
        custom_css: !cssFile ? createForm.customCSS || null : null,
        layout_config: DEFAULT_LAYOUT_CONFIG,
        scripts: [],
        is_active: false,
      });
      if (error) throw error;

      showToast('테마가 생성되었습니다.');
      setCreateForm({ name: '', slug: '', description: '', customCSS: '' });
      setCssFile(null);
      setActiveTab('installed');
      await loadThemes();
    } catch {
      showToast('생성에 실패했습니다.');
    } finally {
      setCreateLoading(false);
    }
  }

  // ------------------------------------------------------------------
  // ZIP 패키지 설치
  // ------------------------------------------------------------------
  async function installFromZip() {
    if (!zipFile) { showToast('ZIP 파일을 선택하세요.'); return; }
    setZipLoading(true);
    setZipLog([]);

    function log(msg: string) { setZipLog((prev) => [...prev, msg]); }

    try {
      log('ZIP 파일 읽는 중...');
      const zip = await JSZip.loadAsync(zipFile);

      // theme.json 필수
      const themeJsonFile = zip.file('theme.json');
      if (!themeJsonFile) throw new Error('theme.json이 없습니다. ZIP 패키지 형식을 확인하세요.');
      const themeData = JSON.parse(await themeJsonFile.async('string'));
      log(`테마 정보: ${themeData.name} v${themeData.version}`);

      // theme.css 업로드
      let cssUrl: string | undefined;
      const cssZipFile = zip.file('theme.css');
      if (cssZipFile) {
        log('theme.css 업로드 중...');
        const cssContent = await cssZipFile.async('string');
        const result = await uploadThemeCSS(themeData.slug, cssContent);
        if (!result.success) throw new Error(`CSS 업로드 실패: ${result.error}`);
        cssUrl = result.url;
        log('theme.css 업로드 완료');
      }

      // thumbnail 업로드
      let thumbnailUrl: string | undefined;
      const thumbnailFiles = zip.file(/^thumbnail\.(png|jpg|jpeg|webp)$/i);
      if (thumbnailFiles.length > 0) {
        log('썸네일 업로드 중...');
        const thumbFile = thumbnailFiles[0];
        const blob = new Blob([await thumbFile.async('arraybuffer')]);
        const ext = thumbFile.name.split('.').pop() || 'png';
        const result = await uploadThemeFile(themeData.slug, `thumbnail.${ext}`, blob);
        if (result.success) { thumbnailUrl = result.url; log('썸네일 업로드 완료'); }
      }

      // skins/*.css 업로드
      const skinFiles = zip.file(/^skins\/[^/]+\.css$/);
      if (skinFiles.length > 0) {
        log(`스킨 CSS ${skinFiles.length}개 업로드 중...`);
        for (const skinFile of skinFiles) {
          const skinSlug = skinFile.name.replace('skins/', '').replace('.css', '');
          const skinCss = await skinFile.async('string');
          await uploadSkinCSS(themeData.slug, skinSlug, skinCss);
          log(`  - ${skinSlug}.css 완료`);
        }
      }

      // sections/*.html 업로드
      const sectionFiles = zip.file(/^sections\/[^/]+\.html$/i);
      const sectionHtmlUrls: Record<string, string> = {};
      if (sectionFiles.length > 0) {
        log(`HTML 섹션 ${sectionFiles.length}개 업로드 중...`);
        for (const sectionFile of sectionFiles) {
          const sectionId = sectionFile.name.replace('sections/', '').replace(/\.html$/i, '');
          const htmlContent = await sectionFile.async('string');
          const { uploadSectionHTML } = await import('@/services/theme-storage');
          const r = await uploadSectionHTML(themeData.slug, sectionId, htmlContent);
          if (r.success && r.url) {
            sectionHtmlUrls[sectionId] = r.url;
            log(`  - sections/${sectionId}.html 완료`);
          } else {
            log(`  ⚠ sections/${sectionId}.html 업로드 실패: ${r.error}`);
          }
        }
      }

      // settings.json 파싱
      let settingsSchema = {};
      let defaultSettings: Record<string, string> = {};
      const settingsJsonFile = zip.file('settings.json');
      if (settingsJsonFile) {
        log('settings.json 파싱 중...');
        const { parseSettingsSchema, extractDefaultSettings } = await import('@/lib/theme/template-engine');
        const schemaStr = await settingsJsonFile.async('string');
        settingsSchema = parseSettingsSchema(schemaStr);
        defaultSettings = extractDefaultSettings(settingsSchema as any);
        log(`설정 항목: ${Object.keys(defaultSettings).length}개 기본값 로드`);
      }

      // DB 설치 (스킨 자동 등록 + 섹션 URL + 설정 스키마)
      log('DB에 테마 등록 중...');
      const result = await installThemePackage(
        { ...themeData, sectionHtmlUrls, settingsSchema, defaultSettings },
        cssUrl, thumbnailUrl
      );
      if (!result.success) throw new Error(result.error);

      log('✓ 설치 완료!');
      showToast(`${themeData.name} 테마가 설치되었습니다.`);
      setZipFile(null);
      await loadThemes();
    } catch (err) {
      log(`✗ 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
      showToast('ZIP 설치 실패');
    } finally {
      setZipLoading(false);
    }
  }

  // ------------------------------------------------------------------
  // 스토어 테마 설치
  // ------------------------------------------------------------------
  async function installFromStore() {
    if (!installModal) return;
    setInstallLoading(true);
    setInstallProgress('');
    setInstallError('');
    try {
      const { getStoreApiUrl } = await import('@/services/store');
      const storeApiUrl = await getStoreApiUrl();
      const accessToken = await getValidAccessToken() || undefined;
      const result = await downloadAndInstallTheme(
        storeApiUrl, installModal.themeId, installModal.themeSlug,
        undefined, accessToken,
        (step) => setInstallProgress(step)
      );
      if (!result.success) {
        if (result.code === 'DOMAIN_NOT_REGISTERED' || result.code === 'DOMAIN_LIMIT_EXCEEDED') {
          setInstallStep('domain');
          return;
        }
        if (result.code === 'NOT_PURCHASED') {
          setInstallError('구매하지 않은 테마입니다. 스토어에서 먼저 구매하세요.');
          return;
        }
        setInstallError(result.error || '설치에 실패했습니다.');
        return;
      }
      showToast('테마가 설치되었습니다.');
      setInstallModal(null);
      setInstallStep('confirm');
      setInstallProgress('');
      setInstallError('');
      setActiveTab('installed');
      await loadThemes();
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : '설치에 실패했습니다.');
    } finally {
      setInstallLoading(false);
    }
  }

  // ============================================================
  // 렌더링
  // ============================================================
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* 스토어 설치 모달 */}
      {installModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">테마 설치 — {installModal.themeName}</h3>
              <button onClick={() => { setInstallModal(null); setInstallStep('confirm'); }}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* confirm: 설치 확인 */}
            {installStep === 'confirm' && (
              <>
                <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">가격</span>
                    <span className="font-semibold">
                      {installModal.price === 0
                        ? <span className="text-green-600">무료</span>
                        : `${installModal.price.toLocaleString()}원`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">설치 도메인</span>
                    <span className="text-xs text-gray-700 font-mono">{window.location.origin}</span>
                  </div>

                  {/* 유료 테마만 계정 연동 표시 */}
                  {installModal.price > 0 && (
                    storeAccount ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">연동 계정</span>
                          <span className="text-blue-600 flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5" />{storeAccount.email}
                          </span>
                        </div>
                        {purchasedThemeIds.includes(installModal.themeId) ? (
                          <div className="flex items-center gap-1 text-green-600 text-xs pt-1 border-t border-gray-200">
                            <CheckCircle className="h-3.5 w-3.5" />구매 완료 — 바로 다운로드 가능
                          </div>
                        ) : (
                          <div className="text-xs text-amber-600 pt-1 border-t border-gray-200">
                            미구매 테마입니다. 스토어에서 구매 후 설치하세요.
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                        <span className="text-xs text-red-500">유료 테마 — 계정 연동 필요</span>
                        <button onClick={connectStoreOAuth} disabled={oauthLoading}
                          className="text-blue-600 text-xs font-medium underline disabled:opacity-50">
                          {oauthLoading ? '연동 중...' : '계정 연동'}
                        </button>
                      </div>
                    )
                  )}

                  {/* 무료 테마 안내 */}
                  {installModal.price === 0 && (
                    <div className="text-xs text-green-600 pt-1 border-t border-gray-200">
                      무료 테마는 로그인 없이 바로 설치 가능합니다.
                    </div>
                  )}
                </div>

                {/* 진행 상태 */}
                {installLoading && installProgress && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mb-3">
                    <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                    {installProgress}
                  </div>
                )}

                {/* 오류 */}
                {installError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                    {installError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => { setInstallModal(null); setInstallStep('confirm'); setInstallProgress(''); setInstallError(''); }}
                    className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">취소</button>
                  <button
                    onClick={installFromStore}
                    disabled={installLoading || (!storeAccount && installModal.price > 0)}
                    className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
                    title={!storeAccount && installModal.price > 0 ? '유료 테마는 계정 연동 후 설치 가능합니다' : ''}
                  >
                    {installLoading ? '설치 중...' : installModal.price === 0 ? '무료 설치' : '구매 확인 후 설치'}
                  </button>
                </div>
              </>
            )}

            {/* domain: 도메인이 구매에 미등록된 경우 */}
            {installStep === 'domain' && (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-sm text-amber-700">
                  <p className="font-medium mb-1">도메인 등록이 필요합니다</p>
                  <p>현재 도메인 <strong>{window.location.origin}</strong> 이 이 테마 구매에 등록되어 있지 않습니다.</p>
                  <p className="mt-2">스토어 → 구매내역에서 도메인을 추가한 후 다시 설치하세요.</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setInstallStep('confirm')}
                    className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">뒤로</button>
                  <a
                    href={`${storeStatus.url}/account/purchases`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium text-center hover:bg-blue-700"
                  >
                    스토어에서 도메인 추가 →
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Palette className="h-7 w-7 text-blue-600" />
            테마 관리
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            테마를 설치하고 <strong>편집</strong> 버튼으로 비주얼 에디터에서 자유롭게 꾸미세요.
          </p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex items-center justify-between border-b mb-6">
        <div className="flex">
          {([['installed', '설치된 테마'], ['available', '테마 스토어'], ['create', '+ 직접 만들기'], ['zip', '📦 ZIP 설치']] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* 스토어 연결 상태 (탭 오른쪽 끝) */}
        <div className="flex items-center gap-2 pb-1">
          {/* 연결 상태 표시 */}
          {!storeStatus.checked ? (
            <RefreshCw className="h-3.5 w-3.5 text-gray-400 animate-spin" />
          ) : (
            <span className={`flex items-center gap-1.5 text-xs ${storeStatus.connected ? 'text-green-600' : 'text-red-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${storeStatus.connected ? 'bg-green-500' : 'bg-red-400'}`} />
              {storeStatus.url && <span className="text-gray-500">{storeStatus.url}</span>}
              {storeStatus.connected ? '연결됨' : '연결 안 됨'}
            </span>
          )}

          {/* 재시도 버튼 — 연결 안 됨일 때 표시 */}
          {storeStatus.checked && !storeStatus.connected && (
            <button
              onClick={() => { setStoreStatus({ connected: false, url: '', checked: false }); checkStore(); }}
              className="text-xs text-gray-400 hover:text-gray-600 border rounded px-1.5 py-0.5 hover:bg-gray-50"
              title="재연결 시도"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}

          {/* 계정 상태 — 연결 여부와 무관하게 항상 표시 */}
          {storeAccount ? (
            <div className="flex items-center gap-1.5 border-l pl-2 ml-1">
              <User className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs text-gray-600 max-w-[140px] truncate">{storeAccount.email}</span>
              <button onClick={disconnectStoreAccount}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors" title="연동 해제">×</button>
            </div>
          ) : (
            <button onClick={connectStoreOAuth} disabled={oauthLoading}
              className="flex items-center gap-1 border border-blue-300 text-blue-600 text-xs px-2.5 py-1 rounded-full hover:bg-blue-50 transition-colors disabled:opacity-50">
              <User className="h-3 w-3" />{oauthLoading ? '연동 중...' : '계정 연동'}
            </button>
          )}
        </div>
      </div>

      {/* 설치된 테마 탭 */}
      {activeTab === 'installed' && (
        loading ? (
          <div className="flex justify-center py-12">
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : themes.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Palette className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>설치된 테마가 없습니다.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {themes.map((theme) => (
              <div key={theme.id} className={`border-2 rounded-xl overflow-hidden bg-white transition-shadow hover:shadow-md ${theme.isActive ? 'border-blue-500' : 'border-gray-200'}`}>
                {/* 썸네일 */}
                <div className="aspect-video bg-gray-100 relative">
                  {theme.thumbnailUrl ? (
                    <img src={theme.thumbnailUrl} alt={theme.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-300">
                      <Palette className="h-12 w-12" />
                    </div>
                  )}
                  {theme.isActive && (
                    <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> 활성
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-gray-800/70 text-white text-xs px-2 py-1 rounded">
                    {theme.source === 'store' ? '스토어' : theme.source === 'custom' ? '직접' : '기본'}
                  </div>
                </div>

                {/* 정보 */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-semibold text-gray-900">{theme.name}</h3>
                    <span className="text-xs text-gray-400">v{theme.version}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-1">{theme.slug}</p>

                  {/* 스킨 선택 */}
                  {theme.skins && theme.skins.length > 0 && (
                    <div className="mb-3">
                      <select
                        value={theme.activeSkinSlug || ''}
                        onChange={(e) => activateSkin(theme.id, e.target.value)}
                        className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">기본 스킨</option>
                        {theme.skins.map((s) => (
                          <option key={s.slug} value={s.slug}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* 레이아웃 요약 */}
                  <div className="text-xs text-gray-400 space-y-0.5 mb-3">
                    <div>헤더: {theme.layoutConfig.header || '없음'} · 푸터: {theme.layoutConfig.footer || '없음'}</div>
                    <div>카드: {theme.layoutConfig.productCard} · 그리드: {theme.layoutConfig.productGrid}</div>
                    {theme.scripts.length > 0 && <div>스크립트: {theme.scripts.length}개</div>}
                  </div>

                  {/* 액션 */}
                  <div className="flex items-center gap-2">
                    {!theme.isActive && (
                      <button
                        onClick={() => activateTheme(theme.id)}
                        disabled={actionLoading === theme.id + '-activate'}
                        className="flex-1 bg-blue-600 text-white text-xs font-medium py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {actionLoading === theme.id + '-activate' ? '적용 중...' : '활성화'}
                      </button>
                    )}
                    {theme.isActive && (
                      <div className="flex-1 text-center text-xs text-blue-600 font-medium py-1.5">
                        현재 적용 중
                      </div>
                    )}
                    <Link
                      to={`/admin/themes/editor?id=${theme.id}`}
                      className="flex items-center gap-1 px-2 py-1.5 border rounded-lg hover:bg-blue-50 hover:border-blue-300 text-gray-500 hover:text-blue-600 text-xs font-medium transition-colors"
                      title="비주얼 에디터"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      편집
                    </Link>
                    <button
                      onClick={() => deleteTheme(theme)}
                      disabled={theme.isActive || actionLoading === theme.id + '-delete'}
                      className="p-1.5 border rounded-lg hover:bg-red-50 text-red-400 disabled:opacity-30"
                      title={theme.isActive ? '활성 테마는 삭제할 수 없습니다' : '삭제'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* 테마 스토어 탭 */}
      {activeTab === 'available' && (
        <>
          {!storeStatus.connected && storeStatus.checked ? (
            <div className="text-center py-16 text-gray-400">
              <Link2Off className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="mb-2 font-medium text-gray-500">스토어 서버에 연결할 수 없습니다</p>
              <p className="text-sm mb-4">관리자 설정에서 <strong>store_api_url</strong>을 확인하세요.</p>
              <Link to="/admin/settings" className="inline-flex items-center gap-1 text-blue-600 text-sm hover:underline">
                설정으로 이동 →
              </Link>
            </div>
          ) : availableLoading ? (
          <div className="flex justify-center py-12">
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : available.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Palette className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="mb-2">등록된 테마가 없습니다.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {available.map((theme) => (
              <div key={theme.id} className="border rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow">
                <div className="aspect-video bg-gray-100 relative">
                  {theme.thumbnail ? (
                    <img src={theme.thumbnail} alt={theme.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-300"><Palette className="h-12 w-12" /></div>
                  )}
                  {theme.isPremium && (
                    <span className="absolute top-2 left-2 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded">프리미엄</span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{theme.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">v{theme.version}</p>
                    </div>
                    <div className="text-right">
                      {theme.price === 0
                        ? <span className="text-green-600 font-bold text-sm">무료</span>
                        : <span className="text-blue-600 font-bold text-sm">{theme.price.toLocaleString()}원</span>
                      }
                    </div>
                  </div>
                  {theme.description && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{theme.description}</p>}
                  {theme.reviewCount && theme.reviewCount > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span>{theme.reviewAvg?.toFixed(1)}</span>
                      <span>({theme.reviewCount})</span>
                    </div>
                  )}
                  {/* 구매 완료 뱃지 */}
                  {theme.price > 0 && storeAccount && purchasedThemeIds.includes(theme.id) && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="h-3.5 w-3.5" />구매 완료
                    </div>
                  )}

                  {/* 설치 버튼 — 이미 설치됐으면 다르게 */}
                  {(() => {
                    const installed = themes.find((t) => t.slug === theme.slug);
                    if (installed) {
                      return (
                        <div className="mt-4 flex gap-2">
                          <div className="flex-1 flex items-center justify-center gap-1.5 border border-green-300 text-green-700 bg-green-50 text-xs font-medium py-2 rounded-lg">
                            <CheckCircle className="h-3.5 w-3.5" />
                            {installed.isActive ? '현재 적용 중' : '설치됨'}
                          </div>
                          <button
                            onClick={() => { setInstallStep('confirm'); setInstallModal({ themeId: theme.id, themeName: theme.name, themeSlug: theme.slug, price: theme.price }); }}
                            className="px-3 py-2 border border-gray-300 text-gray-500 text-xs rounded-lg hover:bg-gray-50"
                            title="업데이트 / 재설치"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    }
                    return (
                      <button
                        onClick={() => { setInstallStep('confirm'); setInstallModal({ themeId: theme.id, themeName: theme.name, themeSlug: theme.slug, price: theme.price }); }}
                        className={`mt-4 w-full text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2
                          ${theme.price === 0 || purchasedThemeIds.includes(theme.id) ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-800'}`}
                      >
                        {theme.price === 0
                          ? <><Download className="h-4 w-4" />무료 설치</>
                          : purchasedThemeIds.includes(theme.id)
                            ? <><Download className="h-4 w-4" />다운로드 설치</>
                            : <><ShoppingCart className="h-4 w-4" />구매 후 설치</>
                        }
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
        </>
      )}

      {/* 직접 만들기 탭 */}
      {activeTab === 'create' && (
        <div className="max-w-2xl space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            직접 CSS를 작성하거나 파일을 업로드해 커스텀 테마를 만들 수 있습니다.
            테마 생성 후 설정 버튼에서 레이아웃 구조, 스크립트, 스킨을 추가로 설정하세요.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">테마명 *</label>
            <input type="text" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="My Custom Theme" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">슬러그 *</label>
            <input type="text" value={createForm.slug} onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
              placeholder="my-custom-theme" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">영문, 숫자, 하이픈만 사용</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
            <input type="text" value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="테마에 대한 설명" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* CSS 파일 업로드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CSS 파일 업로드</label>
            <input ref={fileInputRef} type="file" accept=".css" onChange={(e) => setCssFile(e.target.files?.[0] || null)} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 border-2 border-dashed rounded-lg px-4 py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors w-full justify-center">
              <Upload className="h-4 w-4" />
              {cssFile ? cssFile.name : 'theme.css 파일 선택'}
            </button>
          </div>

          {/* 또는 직접 입력 */}
          {!cssFile && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">또는 CSS 직접 입력</label>
              <textarea value={createForm.customCSS} onChange={(e) => setCreateForm({ ...createForm, customCSS: e.target.value })}
                rows={10} className="w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`:root {\n  --theme-primary: #000000;\n  --theme-font: 'Pretendard', sans-serif;\n}\n\nbody {\n  font-family: var(--theme-font);\n}`} />
            </div>
          )}

          <button onClick={createTheme} disabled={createLoading}
            className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {createLoading ? '생성 중...' : '테마 생성'}
          </button>
        </div>
      )}

      {/* ZIP 설치 탭 */}
      {activeTab === 'zip' && (
        <div className="max-w-2xl space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <p className="font-medium mb-1">ZIP 패키지 구조</p>
            <pre className="text-xs font-mono bg-amber-100 rounded p-2 mt-1">{`my-theme.zip
├── theme.json         ← 필수 (테마 메타 + 스킨 목록)
├── theme.css          ← 테마 CSS
├── thumbnail.png      ← 썸네일 이미지 (선택)
├── settings.json      ← 콘텐츠 설정 스키마 (선택)
├── sections/          ← HTML 템플릿 섹션 (선택)
│   ├── hero.html      ← {{변수명}} 으로 텍스트/이미지 참조
│   └── promo.html
└── skins/
    ├── default.css
    └── dark.css`}</pre>
          </div>

          {/* theme.json 예시 */}
          <details className="border rounded-lg">
            <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer">theme.json 예시 보기</summary>
            <pre className="text-xs font-mono bg-gray-50 p-4 overflow-x-auto text-gray-600">{`{
  "name": "모던 쇼핑몰",
  "slug": "modern-shop",
  "version": "1.0.0",
  "description": "깔끔한 모던 스타일 테마",
  "layout": {
    "header": "mega-menu",
    "footer": "three-column",
    "productCard": "card-basic",
    "productGrid": "grid-4"
  },
  "skins": [
    { "slug": "default", "name": "기본", "default": true },
    { "slug": "dark",    "name": "다크 모드" }
  ]
}`}</pre>
          </details>

          <details className="border rounded-lg">
            <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer">settings.json 예시 보기 (콘텐츠 편집용)</summary>
            <pre className="text-xs font-mono bg-gray-50 p-4 overflow-x-auto text-gray-600">{`{
  "global": [
    { "id": "brand_name", "type": "text",  "label": "쇼핑몰명", "default": "My Shop" },
    { "id": "brand_logo", "type": "image", "label": "로고 이미지 URL" }
  ],
  "sections": [
    {
      "id": "hero",
      "name": "히어로 배너",
      "settings": [
        { "id": "title",  "type": "text",     "label": "제목",     "default": "최고의 쇼핑" },
        { "id": "subtitle","type": "textarea", "label": "부제목" },
        { "id": "bg",     "type": "image",    "label": "배경 이미지 URL" },
        { "id": "btn_color","type": "color",  "label": "버튼 색상", "default": "#000000" }
      ]
    }
  ]
}
--- hero.html에서 사용 예 ---
<section style="background-image:url({{hero_bg}})">
  <h1>{{hero_title | default: '쇼핑하기'}}</h1>
  <p>{{hero_subtitle}}</p>
  <button style="background:{{hero_btn_color}}">구매하기</button>
</section>`}</pre>
          </details>

          {/* 파일 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ZIP 파일 선택</label>
            <input ref={zipFileRef} type="file" accept=".zip" onChange={(e) => { setZipFile(e.target.files?.[0] || null); setZipLog([]); }} className="hidden" />
            <button onClick={() => zipFileRef.current?.click()}
              className={`flex items-center gap-2 border-2 border-dashed rounded-lg px-4 py-6 text-sm transition-colors w-full justify-center ${zipFile ? 'border-blue-400 text-blue-600 bg-blue-50' : 'border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-500'}`}>
              <Package className="h-5 w-5" />
              {zipFile ? zipFile.name : '클릭하여 .zip 파일 선택'}
            </button>
          </div>

          {zipFile && (
            <button onClick={installFromZip} disabled={zipLoading}
              className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {zipLoading ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />설치 중...</>
              ) : (
                <><Package className="h-4 w-4" />ZIP 패키지 설치</>
              )}
            </button>
          )}

          {/* 설치 로그 */}
          {zipLog.length > 0 && (
            <div className="bg-gray-900 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-2 font-medium">설치 로그</p>
              <div className="space-y-0.5">
                {zipLog.map((line, i) => (
                  <p key={i} className={`text-xs font-mono ${line.startsWith('✓') ? 'text-green-400' : line.startsWith('✗') ? 'text-red-400' : 'text-gray-300'}`}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
