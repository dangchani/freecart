import { useState, useEffect, useRef } from 'react';
import { Layers, CheckCircle, Trash2, Download, X, Plus, Upload, ToggleLeft, ToggleRight, Palette, Code, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getStoreSkins, getStoreApiUrl } from '@/services/store';
import { uploadSkinCSS, downloadAndInstallSkin } from '@/services/theme-storage';

// ============================================================
// CSS 코드 에디터 (라인 번호 포함)
// ============================================================
function CssEditor({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);
  const lineCount = Math.max(value.split('\n').length, 1);

  function syncScroll() {
    if (lineNumRef.current && textareaRef.current) {
      lineNumRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Tab 키 → 2칸 공백 삽입
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newVal = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newVal);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
  }

  return (
    <div className="flex border border-gray-700 rounded-lg overflow-hidden bg-gray-900 text-xs font-mono">
      {/* 라인 번호 */}
      <div
        ref={lineNumRef}
        className="py-3 px-2 text-right text-gray-600 select-none overflow-hidden border-r border-gray-700 min-w-[42px]"
        style={{ overflowY: 'hidden' }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="leading-5">{i + 1}</div>
        ))}
      </div>
      {/* 에디터 */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={handleKeyDown}
        rows={18}
        spellCheck={false}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-green-300 py-3 px-3 focus:outline-none leading-5 resize-y placeholder:text-gray-600"
      />
    </div>
  );
}

// ============================================================
// 타입
// ============================================================

interface ThemeSkin {
  id: string;
  slug: string;
  name: string;
  cssUrl?: string;
  themeId: string;
  themeName: string;
  isDefault?: boolean;
}

interface PageSkin {
  id: string;
  slug: string;
  name: string;
  type: string;
  version: string;
  description?: string;
  isActive: boolean;
  isSystem: boolean;
}

interface Theme {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  activeSkinSlug?: string;
}

interface AvailableSkin {
  id: string;
  name: string;
  slug: string;
  type: string;
  version: string;
  description?: string;
  thumbnail?: string;
  price: number;
  reviewAvg?: number;
  reviewCount?: number;
}

const PAGE_SKIN_TYPES: Record<string, string> = {
  board_list: '게시판 목록',
  board_view: '게시판 상세',
  product_list: '상품 목록',
  product_view: '상품 상세',
  cart: '장바구니',
  checkout: '주문/결제',
  mypage: '마이페이지',
};

// ============================================================
// 메인 컴포넌트
// ============================================================

export default function AdminSkinsPage() {
  const [activeTab, setActiveTab] = useState<'theme-skins' | 'page-skins' | 'store'>('theme-skins');

  // 테마별 스킨
  const [themes, setThemes] = useState<Theme[]>([]);
  const [themeSkins, setThemeSkins] = useState<ThemeSkin[]>([]);

  // 페이지 스킨
  const [pageSkins, setPageSkins] = useState<PageSkin[]>([]);

  // 스토어
  const [available, setAvailable] = useState<AvailableSkin[]>([]);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  // CSS 에디터 모달
  const [cssModal, setCssModal] = useState<ThemeSkin | null>(null);
  const [cssContent, setCssContent] = useState('');
  const [cssFile, setCssFile] = useState<File | null>(null);
  const [cssUploadLoading, setCssUploadLoading] = useState(false);
  const [cssLoadingExisting, setCssLoadingExisting] = useState(false);
  const cssFileRef = useRef<HTMLInputElement>(null);

  // 스킨 등록 모달
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', slug: '', themeId: '', type: 'board_list', version: '1.0.0', description: '' });
  const [addLoading, setAddLoading] = useState(false);

  // 스토어 설치 모달
  const [installModal, setInstallModal] = useState<AvailableSkin | null>(null);
  const [installLoading, setInstallLoading] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  // ------------------------------------------------------------------
  // 데이터 로드
  // ------------------------------------------------------------------
  async function loadData() {
    try {
      const supabase = createClient();

      // 설치된 테마 목록
      const { data: themeData } = await supabase
        .from('installed_themes')
        .select('id, name, slug, is_active, active_skin_slug')
        .order('installed_at', { ascending: false });

      const themeList: Theme[] = (themeData || []).map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        isActive: t.is_active,
        activeSkinSlug: t.active_skin_slug,
      }));
      setThemes(themeList);

      // 스킨 전체 조회
      const { data: skinData } = await supabase
        .from('skins')
        .select('*')
        .order('installed_at', { ascending: false });

      const allSkins = skinData || [];

      // 테마 스킨 (theme_id 있음)
      const tSkins: ThemeSkin[] = allSkins
        .filter((s) => s.theme_id)
        .map((s) => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          cssUrl: s.css_url,
          themeId: s.theme_id,
          themeName: themeList.find((t) => t.id === s.theme_id)?.name || '알 수 없음',
        }));
      setThemeSkins(tSkins);

      // 페이지 스킨 (theme_id 없음)
      const pSkins: PageSkin[] = allSkins
        .filter((s) => !s.theme_id)
        .map((s) => ({
          id: s.id,
          slug: s.slug,
          name: s.name,
          type: s.type,
          version: s.version,
          description: s.description,
          isActive: s.is_active,
          isSystem: s.is_system,
        }));
      setPageSkins(pSkins);
    } catch (err) {
      console.error('스킨 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailableSkins() {
    setAvailableLoading(true);
    try {
      const params: { type?: string; limit: number } = { limit: 50 };
      if (typeFilter !== 'all') params.type = typeFilter;
      const result = await getStoreSkins(params);
      if (result.success && result.data) {
        setAvailable(result.data.map((s) => ({
          id: s.id, name: s.name, slug: s.slug, type: s.type,
          version: s.version || '1.0.0', description: s.description,
          thumbnail: s.thumbnail_url, price: s.price,
          reviewAvg: s.review_avg, reviewCount: s.review_count,
        })));
      }
    } catch {}
    finally { setAvailableLoading(false); }
  }

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (activeTab === 'store' && available.length === 0) loadAvailableSkins();
  }, [activeTab]);

  // cssModal이 열릴 때 기존 CSS 자동 로드
  useEffect(() => {
    if (!cssModal?.cssUrl) { setCssContent(''); return; }
    setCssLoadingExisting(true);
    fetch(cssModal.cssUrl)
      .then((r) => r.text())
      .then((text) => setCssContent(text))
      .catch(() => setCssContent('/* CSS 로드 실패 — 직접 입력하세요 */'))
      .finally(() => setCssLoadingExisting(false));
  }, [cssModal?.cssUrl]);

  // ------------------------------------------------------------------
  // 스킨 CSS 업로드
  // ------------------------------------------------------------------
  async function uploadCssForSkin() {
    if (!cssModal) return;
    if (!cssContent.trim()) { showToast('CSS 내용을 입력하거나 파일을 선택하세요.'); return; }
    setCssUploadLoading(true);
    try {
      const finalCss = cssContent;

      // 테마 slug 찾기
      const theme = themes.find((t) => t.id === cssModal.themeId);
      if (!theme) throw new Error('테마를 찾을 수 없습니다.');

      const result = await uploadSkinCSS(theme.slug, cssModal.slug, finalCss);
      if (!result.success) throw new Error(result.error);

      // DB에 css_url 업데이트
      const supabase = createClient();
      await supabase.from('skins').update({ css_url: result.url }).eq('id', cssModal.id);

      setThemeSkins((prev) => prev.map((s) => s.id === cssModal.id ? { ...s, cssUrl: result.url } : s));
      showToast('CSS가 업로드되었습니다.');
      setCssModal(null);
      setCssContent('');
      setCssFile(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'CSS 업로드 실패');
    } finally {
      setCssUploadLoading(false);
    }
  }

  // ------------------------------------------------------------------
  // 테마 스킨 활성화
  // ------------------------------------------------------------------
  async function activateThemeSkin(themeId: string, skinSlug: string) {
    setActionLoading(themeId + '-' + skinSlug);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('installed_themes')
        .update({ active_skin_slug: skinSlug })
        .eq('id', themeId);
      if (error) throw error;
      setThemes((prev) => prev.map((t) => t.id === themeId ? { ...t, activeSkinSlug: skinSlug } : t));
      showToast('스킨이 적용되었습니다.');
    } catch { showToast('스킨 적용 실패'); }
    finally { setActionLoading(null); }
  }

  // ------------------------------------------------------------------
  // 페이지 스킨 토글
  // ------------------------------------------------------------------
  async function togglePageSkin(id: string, current: boolean) {
    setActionLoading(id);
    try {
      const supabase = createClient();
      await supabase.from('skins').update({ is_active: !current }).eq('id', id);
      setPageSkins((prev) => prev.map((s) => s.id === id ? { ...s, isActive: !current } : s));
      showToast(current ? '비활성화되었습니다.' : '활성화되었습니다.');
    } catch { showToast('변경 실패'); }
    finally { setActionLoading(null); }
  }

  // ------------------------------------------------------------------
  // 스킨 삭제
  // ------------------------------------------------------------------
  async function deleteSkin(id: string) {
    if (!confirm('이 스킨을 삭제하시겠습니까?')) return;
    setActionLoading(id + '-delete');
    try {
      const supabase = createClient();
      await supabase.from('skins').delete().eq('id', id);
      setThemeSkins((prev) => prev.filter((s) => s.id !== id));
      setPageSkins((prev) => prev.filter((s) => s.id !== id));
      showToast('스킨이 삭제되었습니다.');
    } catch { showToast('삭제 실패'); }
    finally { setActionLoading(null); }
  }

  // ------------------------------------------------------------------
  // 스킨 등록
  // ------------------------------------------------------------------
  async function addSkin() {
    if (!addForm.name.trim() || !addForm.slug.trim()) {
      showToast('스킨명과 슬러그는 필수입니다.');
      return;
    }
    setAddLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('skins').insert({
        name: addForm.name.trim(),
        slug: addForm.slug.trim(),
        type: addForm.themeId ? 'theme-skin' : addForm.type,
        version: addForm.version || '1.0.0',
        description: addForm.description || null,
        theme_id: addForm.themeId || null,
        is_active: true,
        is_system: false,
      });
      if (error) throw error;
      showToast('스킨이 등록되었습니다.');
      setShowAddModal(false);
      setAddForm({ name: '', slug: '', themeId: '', type: 'board_list', version: '1.0.0', description: '' });
      await loadData();
    } catch { showToast('등록 실패'); }
    finally { setAddLoading(false); }
  }

  // ------------------------------------------------------------------
  // 스토어 스킨 설치
  // ------------------------------------------------------------------
  async function installSkinFromStore() {
    if (!installModal) return;
    setInstallLoading(true);
    try {
      const storeApiUrl = await getStoreApiUrl();
      // 페이지 스킨은 themeId 없이 설치 (테마 slug는 'page-skins' 사용)
      const result = await downloadAndInstallSkin(
        storeApiUrl,
        installModal.id,
        installModal.slug,
        'page-skins',
        null,
      );
      if (!result.success) {
        if (result.code === 'LICENSE_REQUIRED') throw new Error('라이선스 키가 필요한 유료 스킨입니다.');
        throw new Error(result.error);
      }
      showToast(`${installModal.name} 스킨이 설치되었습니다.`);
      setInstallModal(null);
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '설치에 실패했습니다.');
    } finally {
      setInstallLoading(false);
    }
  }

  // ============================================================
  // 렌더링
  // ============================================================

  // 테마별로 스킨 그룹화
  const skinsByTheme = themes.map((theme) => ({
    theme,
    skins: themeSkins.filter((s) => s.themeId === theme.id),
  }));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* 스토어 스킨 설치 모달 */}
      {installModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">스킨 설치 — {installModal.name}</h3>
              <button onClick={() => setInstallModal(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-1">
              {installModal.price === 0 ? '무료 스킨입니다.' : `${installModal.price.toLocaleString()}원 스킨입니다.`}
            </p>
            <p className="text-xs text-gray-400 mb-4">설치 후 페이지 스킨 탭에서 활성화할 수 있습니다.</p>
            <div className="flex gap-3">
              <button onClick={() => setInstallModal(null)} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">취소</button>
              <button onClick={installSkinFromStore} disabled={installLoading}
                className="flex-1 bg-purple-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                {installLoading ? '설치 중...' : installModal.price === 0 ? '무료 설치' : '구매 후 설치'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS 에디터 모달 */}
      {cssModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
              <div>
                <h3 className="font-bold text-lg">스킨 CSS 에디터</h3>
                <p className="text-xs text-gray-400 mt-0.5">{cssModal.name} ({cssModal.slug})</p>
              </div>
              <div className="flex items-center gap-2">
                {cssModal.cssUrl && (
                  <button
                    onClick={() => {
                      setCssLoadingExisting(true);
                      fetch(cssModal.cssUrl!)
                        .then((r) => r.text())
                        .then(setCssContent)
                        .catch(() => setCssContent('/* 로드 실패 */'))
                        .finally(() => setCssLoadingExisting(false));
                    }}
                    className="text-xs text-gray-500 hover:text-purple-600 flex items-center gap-1 px-2 py-1 border rounded"
                    title="현재 저장된 CSS 다시 불러오기"
                  >
                    <RefreshCw className="h-3 w-3" /> 새로고침
                  </button>
                )}
                <button onClick={() => { setCssModal(null); setCssContent(''); setCssFile(null); }}>
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* 에디터 영역 */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {/* 파일 업로드 버튼 */}
              <input ref={cssFileRef} type="file" accept=".css" className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setCssFile(f);
                  const text = await f.text();
                  setCssContent(text);
                }} />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {cssModal.cssUrl ? '기존 CSS가 자동으로 로드되었습니다. 수정 후 저장하세요.' : 'CSS를 직접 작성하거나 파일을 불러오세요.'}
                </span>
                <button onClick={() => cssFileRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs border rounded px-3 py-1.5 text-gray-600 hover:border-purple-400 hover:text-purple-600 transition-colors">
                  <Upload className="h-3.5 w-3.5" />
                  {cssFile ? cssFile.name : '파일에서 불러오기'}
                </button>
              </div>

              {cssLoadingExisting ? (
                <div className="bg-gray-900 rounded-lg h-64 flex items-center justify-center">
                  <span className="text-gray-400 text-sm flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-purple-400" />
                    CSS 로딩 중...
                  </span>
                </div>
              ) : (
                <CssEditor
                  value={cssContent}
                  onChange={setCssContent}
                  placeholder={`:root {\n  --theme-primary: #FF5733;\n  --theme-bg: #FFF8F5;\n  --theme-btn-bg: #FF5733;\n  --theme-font: 'Noto Sans KR', sans-serif;\n}\n\n.product-card {\n  border-radius: 16px;\n  box-shadow: 0 4px 20px rgba(0,0,0,0.08);\n}`}
                />
              )}

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{cssContent.split('\n').length} 줄 · {cssContent.length} 자</span>
                <span>Tab = 2칸 들여쓰기</span>
              </div>
            </div>

            {/* 푸터 */}
            <div className="p-5 border-t flex justify-end gap-3 flex-shrink-0">
              <button onClick={() => { setCssModal(null); setCssContent(''); setCssFile(null); }}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">취소</button>
              <button onClick={uploadCssForSkin} disabled={cssUploadLoading || cssLoadingExisting}
                className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                {cssUploadLoading ? '저장 중...' : 'CSS 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 스킨 등록 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">스킨 등록</h3>
              <button onClick={() => setShowAddModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">스킨명 *</label>
                <input type="text" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="다크 스킨" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">슬러그 *</label>
                <input type="text" value={addForm.slug} onChange={(e) => setAddForm({ ...addForm, slug: e.target.value })}
                  placeholder="dark" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">연결 테마 (테마 스킨인 경우)</label>
                <select value={addForm.themeId} onChange={(e) => setAddForm({ ...addForm, themeId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="">없음 (페이지 스킨)</option>
                  {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {!addForm.themeId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">페이지 타입</label>
                  <select value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                    {Object.entries(PAGE_SKIN_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <input type="text" value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                  placeholder="스킨 설명" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">취소</button>
              <button onClick={addSkin} disabled={addLoading} className="flex-1 bg-purple-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                {addLoading ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="h-7 w-7 text-purple-600" />
            스킨 관리
          </h1>
          <p className="text-gray-500 text-sm mt-1">테마 스킨과 페이지별 스킨을 관리합니다.</p>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700">
          <Plus className="h-4 w-4" /> 스킨 등록
        </button>
      </div>

      {/* 탭 */}
      <div className="flex border-b mb-6">
        {([['theme-skins', '테마 스킨'], ['page-skins', '페이지 스킨'], ['store', '스킨 스토어']] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* 테마 스킨 탭 */}
          {activeTab === 'theme-skins' && (
            <div className="space-y-6">
              {skinsByTheme.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>설치된 테마가 없습니다.</p>
                </div>
              )}
              {skinsByTheme.map(({ theme, skins }) => (
                <div key={theme.id} className="border rounded-xl overflow-hidden">
                  {/* 테마 헤더 */}
                  <div className={`px-4 py-3 flex items-center justify-between ${theme.isActive ? 'bg-blue-50 border-b border-blue-100' : 'bg-gray-50 border-b'}`}>
                    <div className="flex items-center gap-2">
                      <Palette className={`h-4 w-4 ${theme.isActive ? 'text-blue-500' : 'text-gray-400'}`} />
                      <span className="font-medium text-sm">{theme.name}</span>
                      {theme.isActive && (
                        <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full">활성</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{skins.length}개 스킨</span>
                  </div>

                  {/* 스킨 목록 */}
                  {skins.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">
                      이 테마에 등록된 스킨이 없습니다.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4">
                      {skins.map((skin) => {
                        const isActive = theme.activeSkinSlug === skin.slug;
                        return (
                          <button
                            key={skin.id}
                            onClick={() => activateThemeSkin(theme.id, skin.slug)}
                            disabled={actionLoading === theme.id + '-' + skin.slug}
                            className={`border-2 rounded-lg p-3 text-left transition-all ${isActive ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'} disabled:opacity-50`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium truncate">{skin.name}</span>
                              {isActive && <CheckCircle className="h-4 w-4 text-purple-500 shrink-0" />}
                            </div>
                            <div className="text-xs text-gray-400">{skin.slug}</div>
                            <div className="mt-2 flex items-center justify-between">
                              {isActive && (
                                <span className="text-xs text-purple-600 font-medium">적용 중</span>
                              )}
                              <div className="ml-auto flex items-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setCssModal(skin); setCssContent(''); setCssFile(null); }}
                                  className="p-1 hover:bg-purple-50 rounded text-purple-400"
                                  title="CSS 업로드"
                                >
                                  <Code className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteSkin(skin.id); }}
                                  className="p-1 hover:bg-red-50 rounded text-red-400"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 페이지 스킨 탭 */}
          {activeTab === 'page-skins' && (
            pageSkins.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>등록된 페이지 스킨이 없습니다.</p>
              </div>
            ) : (
              <div className="bg-white border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">스킨명</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">타입</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">버전</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pageSkins.map((skin) => (
                      <tr key={skin.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <span className="font-medium">{skin.name}</span>
                            {skin.isSystem && <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">시스템</span>}
                            <div className="text-xs text-gray-400 mt-0.5">{skin.slug}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2 py-1 rounded-full">
                            {PAGE_SKIN_TYPES[skin.type] || skin.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">v{skin.version}</td>
                        <td className="px-4 py-3">
                          {skin.isActive
                            ? <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full"><CheckCircle className="h-3 w-3" />활성</span>
                            : <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">비활성</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => togglePageSkin(skin.id, skin.isActive)} disabled={!!actionLoading}
                              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50">
                              {skin.isActive ? <ToggleRight className="h-5 w-5 text-green-600" /> : <ToggleLeft className="h-5 w-5 text-gray-400" />}
                            </button>
                            <button onClick={() => deleteSkin(skin.id)} disabled={skin.isSystem || skin.isActive}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 disabled:opacity-30">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* 스토어 탭 */}
          {activeTab === 'store' && (
            <div>
              <div className="mb-4 flex items-center gap-3">
                <label className="text-sm text-gray-600">타입 필터:</label>
                <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setAvailable([]); }}
                  className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none">
                  <option value="all">전체</option>
                  {Object.entries(PAGE_SKIN_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button onClick={() => { setAvailable([]); loadAvailableSkins(); }} className="text-sm text-purple-600 hover:text-purple-700">새로고침</button>
              </div>
              {availableLoading ? (
                <div className="flex justify-center py-12">
                  <span className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
                </div>
              ) : available.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="mb-1">스킨 스토어에 연결할 수 없거나 등록된 스킨이 없습니다.</p>
                  <p className="text-xs">환경변수 <code className="bg-gray-100 px-1 rounded">VITE_STORE_API_URL</code>을 확인하세요.</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {available.map((skin) => (
                    <div key={skin.id} className="border rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow">
                      <div className="aspect-video bg-gray-100 relative">
                        {skin.thumbnail ? <img src={skin.thumbnail} alt={skin.name} className="w-full h-full object-cover" />
                          : <div className="flex items-center justify-center h-full text-gray-300"><Layers className="h-12 w-12" /></div>}
                        <span className="absolute top-2 right-2 bg-gray-800/70 text-white text-xs px-2 py-1 rounded">
                          {PAGE_SKIN_TYPES[skin.type] || skin.type}
                        </span>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{skin.name}</h3>
                            <p className="text-xs text-gray-400 mt-0.5">v{skin.version}</p>
                          </div>
                          {skin.price === 0
                            ? <span className="text-green-600 font-bold text-sm">무료</span>
                            : <span className="text-purple-600 font-bold text-sm">{skin.price.toLocaleString()}원</span>}
                        </div>
                        {skin.description && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{skin.description}</p>}
                        <button
                          onClick={() => setInstallModal(skin)}
                          className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2">
                          <Download className="h-4 w-4" />{skin.price === 0 ? '무료 설치' : '구매 후 설치'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
