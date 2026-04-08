/**
 * 테마 코드 에디터 (VS Code 스타일)
 * ─ 우측 전체 = Monaco HTML 에디터 (라인번호 + 구문강조)
 * ─ 미리보기 토글
 * ─ 섹션 패널: 그룹별 분류 + 드래그 정렬 + 활성화 토글
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft, Monitor, Smartphone, Save,
  LayoutTemplate, Type, Palette, Layers, Code, FileCode,
  Play, ToggleLeft, ToggleRight, CheckCircle, X, Plus, Upload,
  Eye, EyeOff, File, GripVertical, Pin,
} from 'lucide-react';
import { ThemeSection } from '@/components/theme/ThemeSection';
import { uploadSectionHTML } from '@/services/theme-storage';
import {
  DEFAULT_CSS_VARIABLES,
  type ThemeLayoutConfig,
  type ThemeCssVariables,
  type ThemeScript,
} from '@/lib/theme/types';
import { DEFAULT_LAYOUT_CONFIG } from '@/lib/theme/types';
import type { ThemeSettingsSchema, SettingItem } from '@/lib/theme/template-engine';
import { useThemeConfig } from '@/lib/theme';

// ============================================================
// Types
// ============================================================

interface ThemeData {
  id: string;
  slug: string;
  name: string;
  version: string;
  layoutConfig: ThemeLayoutConfig;
  customCss: string;
  cssVariables: Partial<ThemeCssVariables>;
  scripts: ThemeScript[];
  activeSkinSlug?: string;
  skins: { slug: string; name: string; cssUrl?: string }[];
  themeSettings: Record<string, string>;
  settingsSchema: ThemeSettingsSchema;
  sectionHtmlUrls: Record<string, string>;
}

interface EditorSection {
  id: string;
  title: string;
  htmlUrl: string;
  enabled: boolean;
}

type SidePanel = 'sections' | 'content' | 'colors' | 'skin' | 'scripts' | 'css';

const PANELS: { id: SidePanel; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: 'sections', icon: LayoutTemplate, label: '섹션' },
  { id: 'content',  icon: Type,           label: '콘텐츠' },
  { id: 'colors',   icon: Palette,        label: '색상' },
  { id: 'skin',     icon: Layers,         label: '스킨' },
  { id: 'scripts',  icon: Play,           label: '스크립트' },
  { id: 'css',      icon: Code,           label: 'CSS' },
];

const COLOR_VARS: { key: keyof ThemeCssVariables; label: string }[] = [
  { key: 'primary',     label: '주색상' },
  { key: 'secondary',   label: '보조색상' },
  { key: 'accent',      label: '강조색상' },
  { key: 'bg',          label: '배경' },
  { key: 'bgSecondary', label: '보조 배경' },
  { key: 'text',        label: '텍스트' },
  { key: 'textMuted',   label: '흐린 텍스트' },
  { key: 'headerBg',    label: '헤더 배경' },
  { key: 'headerText',  label: '헤더 텍스트' },
  { key: 'btnBg',       label: '버튼 배경' },
  { key: 'btnText',     label: '버튼 텍스트' },
];

const TEXT_VARS: { key: keyof ThemeCssVariables; label: string }[] = [
  { key: 'font',         label: '본문 폰트' },
  { key: 'fontHeading',  label: '제목 폰트' },
  { key: 'headerHeight', label: '헤더 높이' },
  { key: 'btnRadius',    label: '버튼 모서리' },
  { key: 'cardRadius',   label: '카드 모서리' },
  { key: 'maxWidth',     label: '최대 너비' },
];

// 섹션 ID → 그룹 분류
type SectionGroup = 'layout' | 'home' | 'shop' | 'community' | 'account' | 'etc';

const GROUP_META: Record<SectionGroup, { label: string; color: string }> = {
  layout:    { label: '레이아웃',   color: 'text-gray-400' },
  home:      { label: '홈페이지',   color: 'text-green-400' },
  shop:      { label: '상품/쇼핑',  color: 'text-orange-400' },
  community: { label: '커뮤니티',   color: 'text-purple-400' },
  account:   { label: '계정/기타',  color: 'text-pink-400' },
  etc:       { label: '기타',       color: 'text-gray-500' },
};

function getSectionGroup(id: string): SectionGroup {
  if (id === 'header' || id === 'footer' || id === 'nav') return 'layout';
  const HOME = ['hero', 'features', 'products', 'banner', 'reviews', 'newsletter', 'categories', 'brands', 'cta', 'promo', 'gallery', 'stats'];
  if (HOME.includes(id)) return 'home';
  if (id.startsWith('product') || ['cart', 'checkout', 'wishlist', 'order'].includes(id)) return 'shop';
  if (id.startsWith('board') || id.startsWith('post') || id.startsWith('community')) return 'community';
  if (['login', 'signup', 'mypage', 'terms', 'privacy', 'account', 'password', 'profile'].includes(id) || id.startsWith('my')) return 'account';
  return 'etc';
}

// ============================================================
// SettingInput
// ============================================================

function SettingInput({
  item, valueKey, settings, onChange,
}: {
  item: SettingItem;
  valueKey: string;
  settings: Record<string, string>;
  onChange: (k: string, v: string) => void;
}) {
  const value = settings[valueKey] ?? item.default ?? '';
  const set = (v: string) => onChange(valueKey, v);

  if (item.type === 'textarea')
    return <textarea value={value} onChange={(e) => set(e.target.value)} placeholder={item.placeholder} rows={3} spellCheck={false}
      className="w-full border border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-800 text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />;
  if (item.type === 'color')
    return (
      <div className="flex items-center gap-2">
        <input type="color" value={value || '#000000'} onChange={(e) => set(e.target.value)}
          className="h-9 w-12 rounded border border-gray-700 cursor-pointer p-0.5 flex-shrink-0 bg-gray-800" />
        <input type="text" value={value} onChange={(e) => set(e.target.value)} placeholder="#000000"
          className="flex-1 min-w-0 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono bg-gray-800 text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>
    );
  if (item.type === 'select')
    return (
      <select value={value} onChange={(e) => set(e.target.value)}
        className="w-full border border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-800 text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500">
        {item.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  if (item.type === 'checkbox')
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={value === 'true'} onChange={(e) => set(e.target.checked ? 'true' : 'false')} className="rounded w-4 h-4" />
        <span className="text-sm text-gray-300">{item.label}</span>
      </label>
    );
  if (item.type === 'image')
    return (
      <div className="space-y-1.5">
        <input type="url" value={value} onChange={(e) => set(e.target.value)} placeholder={item.placeholder || 'https://...'}
          className="w-full border border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-800 text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        {value && <img src={value} alt="preview" className="w-full h-20 object-cover rounded border border-gray-700"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
      </div>
    );
  return <input type={item.type === 'number' ? 'number' : item.type === 'url' ? 'url' : 'text'}
    value={value} onChange={(e) => set(e.target.value)} placeholder={item.placeholder}
    className="w-full border border-gray-700 rounded-lg px-3 py-2 text-sm bg-gray-800 text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />;
}

// ============================================================
// ScriptManager
// ============================================================

function ScriptManager({ scripts, onChange }: { scripts: ThemeScript[]; onChange: (s: ThemeScript[]) => void }) {
  const [newScript, setNewScript] = useState<Partial<ThemeScript>>({ position: 'body-end', enabled: true });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function add() {
    if (!newScript.name?.trim() || (!newScript.content?.trim() && !newScript.src?.trim())) return;
    onChange([...scripts, {
      id: `script-${Date.now()}`,
      name: newScript.name.trim(),
      content: newScript.content?.trim() || undefined,
      src: newScript.src?.trim() || undefined,
      position: newScript.position || 'body-end',
      enabled: true,
    }]);
    setNewScript({ position: 'body-end', enabled: true });
  }

  const posLabel: Record<string, string> = { head: 'HEAD', 'body-start': 'BODY 시작', 'body-end': 'BODY 끝' };

  return (
    <div className="p-4 space-y-3">
      <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3 text-xs text-amber-400">
        ⚠️ 스크립트는 사이트에 직접 실행됩니다. 신뢰할 수 있는 코드만 추가하세요.
      </div>
      {scripts.length === 0 && <p className="text-xs text-gray-600 text-center py-3">등록된 스크립트 없음</p>}
      {scripts.map((s) => (
        <div key={s.id} className={`border rounded-xl p-3 ${s.enabled ? 'border-gray-700' : 'border-gray-800 opacity-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => onChange(scripts.map((x) => x.id === s.id ? { ...x, enabled: !x.enabled } : x))}>
                {s.enabled ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-gray-600" />}
              </button>
              <span className="text-xs font-medium text-gray-300">{s.name}</span>
              <span className="text-[10px] bg-gray-800 px-1.5 py-0.5 rounded text-gray-500">{posLabel[s.position]}</span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)} className="p-1 hover:bg-gray-800 rounded text-gray-500">
                <Code className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onChange(scripts.filter((x) => x.id !== s.id))} className="p-1 hover:bg-red-900/30 rounded text-red-500">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {expandedId === s.id && (
            <textarea value={s.content || s.src || ''}
              onChange={(e) => onChange(scripts.map((x) => x.id === s.id ? { ...x, content: e.target.value, src: undefined } : x))}
              className="w-full mt-2 border border-gray-700 rounded px-2 py-1.5 text-xs font-mono h-24 bg-gray-900 text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          )}
        </div>
      ))}
      <div className="border border-dashed border-gray-700 rounded-xl p-3 space-y-2">
        <p className="text-xs font-medium text-gray-400">스크립트 추가</p>
        <input type="text" value={newScript.name || ''} onChange={(e) => setNewScript({ ...newScript, name: e.target.value })}
          placeholder="이름" className="w-full border border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-gray-800 text-gray-200 focus:outline-none" />
        <div className="flex gap-2">
          <select value={newScript.position || 'body-end'} onChange={(e) => setNewScript({ ...newScript, position: e.target.value as any })}
            className="border border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-gray-800 text-gray-200 focus:outline-none">
            <option value="head">HEAD</option>
            <option value="body-start">BODY 시작</option>
            <option value="body-end">BODY 끝</option>
          </select>
          <input type="url" value={newScript.src || ''} onChange={(e) => setNewScript({ ...newScript, src: e.target.value, content: '' })}
            placeholder="외부 JS URL" className="flex-1 border border-gray-700 rounded-lg px-2 py-1.5 text-xs bg-gray-800 text-gray-200 focus:outline-none" />
        </div>
        <textarea value={newScript.content || ''} onChange={(e) => setNewScript({ ...newScript, content: e.target.value, src: '' })}
          placeholder="또는 인라인 JavaScript" rows={2}
          className="w-full border border-gray-700 rounded-lg px-2 py-1.5 text-xs font-mono bg-gray-800 text-gray-200 focus:outline-none" />
        <button onClick={add} className="w-full bg-gray-700 hover:bg-gray-600 text-white text-xs py-1.5 rounded-lg flex items-center justify-center gap-1">
          <Plus className="h-3 w-3" /> 추가
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Main Editor
// ============================================================

export default function ThemeEditorPage() {
  const [searchParams] = useSearchParams();
  const themeId = searchParams.get('id');
  const { refreshTheme } = useThemeConfig();

  const [theme, setTheme] = useState<ThemeData | null>(null);
  const [loading, setLoading] = useState(true);

  // settings
  const [editSettings, setEditSettings] = useState<Record<string, string>>({});
  const [editSections, setEditSections] = useState<EditorSection[]>([]);
  const [editCss, setEditCss] = useState('');
  const [editCssVars, setEditCssVars] = useState<Partial<ThemeCssVariables>>({});
  const [editSkin, setEditSkin] = useState('');
  const [editScripts, setEditScripts] = useState<ThemeScript[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  // UI
  const [panel, setPanel] = useState<SidePanel>('sections');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [showPreview, setShowPreview] = useState(false);

  // HTML editor
  const [htmlMap, setHtmlMap] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [htmlLoading, setHtmlLoading] = useState(false);
  const [htmlSaving, setHtmlSaving] = useState(false);

  // drag
  const dragIdx = useRef<number | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }
  function dirty() { setIsDirty(true); }

  // ----------------------------------------------------------------
  // Load
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!themeId) { setLoading(false); return; }
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('installed_themes')
        .select('*, skins(slug, name, css_url)')
        .eq('id', themeId)
        .single();

      if (data) {
        const htmlUrls: Record<string, string> = data.section_html_urls || {};
        const layoutConf: ThemeLayoutConfig = {
          ...DEFAULT_LAYOUT_CONFIG, ...(data.layout_config || {}),
          settings: { ...DEFAULT_LAYOUT_CONFIG.settings, ...(data.layout_config?.settings || {}) },
        };

        // 본문 섹션 구성 (header/footer/layout 제외)
        const ordered: EditorSection[] = [];
        const seen = new Set<string>();
        for (const hs of layoutConf.homeSections) {
          if (htmlUrls[hs.id]) {
            ordered.push({ id: hs.id, title: hs.title || hs.id, htmlUrl: htmlUrls[hs.id], enabled: hs.enabled !== false });
            seen.add(hs.id);
          }
        }
        for (const k of Object.keys(htmlUrls)) {
          if (!seen.has(k) && k !== 'header' && k !== 'footer' && k !== 'layout') {
            ordered.push({ id: k, title: k, htmlUrl: htmlUrls[k], enabled: true });
          }
        }

        const t: ThemeData = {
          id: data.id, slug: data.slug, name: data.name, version: data.version,
          layoutConfig: layoutConf,
          customCss: data.custom_css || '',
          cssVariables: data.css_variables || {},
          scripts: Array.isArray(data.scripts) ? data.scripts : [],
          activeSkinSlug: data.active_skin_slug || '',
          skins: (data.skins || []).map((s: any) => ({ slug: s.slug, name: s.name, cssUrl: s.css_url })),
          themeSettings: data.theme_settings || {},
          settingsSchema: data.settings_schema || {},
          sectionHtmlUrls: htmlUrls,
        };
        setTheme(t);
        setEditSettings(t.themeSettings);
        setEditSections(ordered);
        setEditCss(t.customCss);
        setEditCssVars(t.cssVariables);
        setEditSkin(t.activeSkinSlug || '');
        setEditScripts(t.scripts);
      }
      setLoading(false);
    })();
  }, [themeId]);

  // ----------------------------------------------------------------
  // Section helpers
  // ----------------------------------------------------------------
  function toggleSection(id: string) {
    setEditSections((p) => p.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s));
    dirty();
  }

  function onDragStart(i: number) { dragIdx.current = i; }
  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === i) return;
    const s = [...editSections];
    const [m] = s.splice(dragIdx.current, 1);
    s.splice(i, 0, m);
    dragIdx.current = i;
    setEditSections(s);
    dirty();
  }

  // ----------------------------------------------------------------
  // HTML file open / save
  // ----------------------------------------------------------------
  async function openFile(fileId: string) {
    setEditingId(fileId);
    if (htmlMap[fileId] !== undefined) return;
    if (!theme) return;
    const url = theme.sectionHtmlUrls[fileId];
    if (!url) return;

    setHtmlLoading(true);
    try {
      const res = await fetch(url + '?t=' + Date.now());
      const text = await res.text();
      setHtmlMap((p) => ({ ...p, [fileId]: text }));
    } catch {
      showToast('파일 로드 실패');
    } finally {
      setHtmlLoading(false);
    }
  }

  async function saveCurrentFile() {
    if (!theme || editingId === null || htmlMap[editingId] === undefined) return;
    setHtmlSaving(true);
    try {
      const result = await uploadSectionHTML(theme.slug, editingId, htmlMap[editingId]);
      if (!result.success) throw new Error(result.error);
      showToast(`${editingId}.html 저장 완료`);
    } catch (e) {
      showToast('저장 실패: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setHtmlSaving(false);
    }
  }

  // ----------------------------------------------------------------
  // Settings helpers
  // ----------------------------------------------------------------
  function updateSetting(key: string, val: string) { setEditSettings((p) => ({ ...p, [key]: val })); dirty(); }
  function updateCssVar(key: keyof ThemeCssVariables, val: string) { setEditCssVars((p) => ({ ...p, [key]: val })); dirty(); }
  function resetCssVar(key: keyof ThemeCssVariables) { setEditCssVars((p) => { const n = { ...p }; delete n[key]; return n; }); dirty(); }

  const cssVarStyle = useMemo(() => {
    const m = { ...DEFAULT_CSS_VARIABLES, ...editCssVars };
    const vars = Object.entries(m).map(([k, v]) => `--theme-${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v};`).join(' ');
    return `.tep { ${vars} }`;
  }, [editCssVars]);

  // ----------------------------------------------------------------
  // Save settings
  // ----------------------------------------------------------------
  async function save() {
    if (!theme) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const homeSections = editSections.map((s) => ({
        id: s.id, type: 'custom' as const, style: 'html', title: s.title, enabled: s.enabled,
      }));
      const newLayout = { ...theme.layoutConfig, homeSections };
      const { error } = await supabase.from('installed_themes').update({
        layout_config: newLayout,
        custom_css: editCss,
        css_variables: editCssVars,
        active_skin_slug: editSkin || null,
        theme_settings: editSettings,
        scripts: editScripts,
      }).eq('id', theme.id);
      if (error) throw error;
      setIsDirty(false);
      setTheme((p) => p ? { ...p, layoutConfig: newLayout, customCss: editCss, cssVariables: editCssVars, activeSkinSlug: editSkin, themeSettings: editSettings, scripts: editScripts } : p);
      await refreshTheme();
      showToast('저장되었습니다.');
    } catch {
      showToast('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  // ----------------------------------------------------------------
  // Guards
  // ----------------------------------------------------------------
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-900">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  );
  if (!theme) return (
    <div className="flex flex-col items-center justify-center h-screen gap-3 text-gray-500">
      <p>테마를 찾을 수 없습니다.</p>
      <Link to="/admin/themes" className="text-blue-600 underline text-sm">← 테마 관리로</Link>
    </div>
  );

  const hasHeaderTemplate = !!theme.sectionHtmlUrls['header'];
  const hasFooterTemplate = !!theme.sectionHtmlUrls['footer'];

  const allSectionsSchema = theme.settingsSchema?.sections ?? [];
  const globalSchema = theme.settingsSchema?.global ?? [];

  // 섹션을 그룹별로 분류 (layout 그룹은 header/footer만)
  const groupedSections = editSections.reduce<Record<string, EditorSection[]>>((acc, s) => {
    const g = getSectionGroup(s.id);
    if (g === 'layout') return acc; // header/footer는 별도 처리
    (acc[g] ??= []).push(s);
    return acc;
  }, {});
  const usedGroups = (['home', 'shop', 'community', 'account', 'etc'] as SectionGroup[]).filter((g) => groupedSections[g]?.length);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-900">
      <style>{cssVarStyle}</style>
      {editCss && <style>{editCss}</style>}

      {/* ════ TOOLBAR ════ */}
      <div className="flex items-center h-11 bg-gray-950 px-3 gap-2 flex-shrink-0 border-b border-gray-800 z-30">
        <Link to="/admin/themes"
          className="flex items-center gap-1 text-gray-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-800 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> 테마 관리
        </Link>
        <div className="h-3.5 w-px bg-gray-700" />
        <span className="text-white text-sm font-medium">{theme.name}</span>
        <span className="text-gray-600 text-xs">v{theme.version}</span>
        {isDirty && <span className="text-[10px] text-amber-400 font-medium bg-amber-900/30 px-1.5 py-0.5 rounded">미저장</span>}
        <div className="flex-1" />
        <button onClick={() => setShowPreview((p) => !p)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${showPreview ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700'}`}>
          {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showPreview ? '코드 편집' : '미리보기'}
        </button>
        {showPreview && (
          <div className="flex items-center bg-gray-800 rounded-md p-0.5 gap-0.5">
            <button onClick={() => setDevice('desktop')} className={`p-1.5 rounded transition-colors ${device === 'desktop' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setDevice('mobile')} className={`p-1.5 rounded transition-colors ${device === 'mobile' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {editingId && !showPreview && (
          <button onClick={saveCurrentFile} disabled={htmlSaving || htmlMap[editingId] === undefined}
            className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors">
            <Upload className="h-3.5 w-3.5" />
            {htmlSaving ? '저장 중...' : 'HTML 저장'}
          </button>
        )}
        <button onClick={save} disabled={saving || !isDirty}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors">
          <Save className="h-3.5 w-3.5" />
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ════ ICON RAIL ════ */}
        <div className="w-14 bg-gray-900 flex flex-col items-center py-3 gap-1 border-r border-gray-800 flex-shrink-0">
          {PANELS.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setPanel(id)}
              className={`flex flex-col items-center gap-0.5 w-12 py-2.5 rounded-xl text-[10px] leading-none transition-colors ${panel === id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'}`}>
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* ════ SIDEBAR ════ */}
        <div className="w-64 bg-[#1e1e1e] flex flex-col overflow-hidden border-r border-gray-800 flex-shrink-0">
          <div className="px-3 py-2.5 border-b border-gray-800">
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              {PANELS.find((p) => p.id === panel)?.label}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* ─── 섹션 패널 ─── */}
            {panel === 'sections' && (
              <div className="py-2">

                {/* 레이아웃 그룹 (header/footer 고정) */}
                {(hasHeaderTemplate || hasFooterTemplate) && (
                  <div className="mb-1">
                    <div className="flex items-center gap-1.5 px-3 py-1.5">
                      <Pin className="h-3 w-3 text-purple-400" />
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">레이아웃</span>
                    </div>
                    {hasHeaderTemplate && (
                      <SectionFileRow
                        id="header" label="header.html"
                        editingId={editingId}
                        onEdit={openFile}
                      />
                    )}
                    {hasFooterTemplate && (
                      <SectionFileRow
                        id="footer" label="footer.html"
                        editingId={editingId}
                        onEdit={openFile}
                      />
                    )}
                    <div className="mx-3 mt-1 mb-2 border-t border-gray-800" />
                  </div>
                )}

                {/* 그룹별 본문 섹션 */}
                {usedGroups.map((group) => (
                  <div key={group} className="mb-1">
                    <div className="flex items-center gap-1.5 px-3 py-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${GROUP_META[group].color}`}>
                        {GROUP_META[group].label}
                      </span>
                    </div>
                    {groupedSections[group]!.map((sec, localIdx) => {
                      const globalIdx = editSections.indexOf(sec);
                      return (
                        <DraggableSectionRow
                          key={sec.id}
                          sec={sec}
                          globalIdx={globalIdx}
                          editingId={editingId}
                          onEdit={openFile}
                          onToggle={toggleSection}
                          onDragStart={onDragStart}
                          onDragOver={onDragOver}
                          onDragEnd={() => { dragIdx.current = null; }}
                        />
                      );
                    })}
                    <div className="mx-3 mt-1 mb-2 border-t border-gray-800" />
                  </div>
                ))}

                {editSections.length === 0 && (
                  <p className="text-xs text-gray-600 text-center py-8">섹션 없음</p>
                )}
              </div>
            )}

            {/* ─── 콘텐츠 패널 ─── */}
            {panel === 'content' && (
              <div className="p-4">
                {globalSchema.length === 0 && allSectionsSchema.length === 0 && (
                  <div className="text-center py-10 text-gray-600">
                    <Type className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm text-gray-500">콘텐츠 설정 없음</p>
                    <p className="text-xs mt-1 text-gray-600 leading-relaxed">settings.json을 포함하면<br />여기서 편집합니다.</p>
                  </div>
                )}
                {globalSchema.length > 0 && (
                  <div className="mb-5">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">전역 설정</p>
                    {globalSchema.map((item) => (
                      <div key={item.id} className="mb-3">
                        {item.type !== 'checkbox' && <label className="block text-xs font-medium text-gray-400 mb-1">{item.label}</label>}
                        <SettingInput item={item} valueKey={item.id} settings={editSettings} onChange={updateSetting} />
                      </div>
                    ))}
                  </div>
                )}
                {allSectionsSchema.map((sec) => (
                  <details key={sec.id} className="border border-gray-800 rounded-xl mb-2">
                    <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer text-sm font-medium text-gray-300 hover:bg-gray-800 list-none rounded-xl">
                      <span className="text-gray-600 font-mono text-[10px]">{sec.id}</span>
                      <span>{sec.name}</span>
                    </summary>
                    <div className="px-3 pb-3 border-t border-gray-800 pt-2 space-y-3">
                      {sec.settings.map((item) => (
                        <div key={item.id}>
                          {item.type !== 'checkbox' && <label className="block text-xs font-medium text-gray-400 mb-1">{item.label}</label>}
                          <SettingInput item={item} valueKey={`${sec.id}_${item.id}`} settings={editSettings} onChange={updateSetting} />
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}

            {/* ─── 색상 패널 ─── */}
            {panel === 'colors' && (
              <div className="p-4 space-y-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">CSS 변수</p>
                <p className="text-[10px] text-gray-600">HTML에서 <code className="text-blue-400">var(--theme-primary)</code> 등으로 사용</p>
                {COLOR_VARS.map(({ key, label }) => {
                  const val = (editCssVars[key] ?? (DEFAULT_CSS_VARIABLES as any)[key]) as string;
                  const isCustom = key in editCssVars;
                  return (
                    <div key={key}>
                      <label className="flex items-center justify-between text-xs font-medium text-gray-400 mb-1">
                        {label}
                        {isCustom && <button onClick={() => resetCssVar(key)} className="text-gray-600 hover:text-gray-400 text-[10px]">재설정</button>}
                      </label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={val || '#000000'} onChange={(e) => updateCssVar(key, e.target.value)}
                          className="h-8 w-10 rounded border border-gray-700 cursor-pointer p-0.5 flex-shrink-0 bg-gray-800" />
                        <input type="text" value={val} onChange={(e) => updateCssVar(key, e.target.value)}
                          className="flex-1 min-w-0 border border-gray-700 rounded-lg px-2 py-1.5 text-xs font-mono bg-gray-800 text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-3 border-t border-gray-800">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">폰트 / 크기</p>
                  {TEXT_VARS.map(({ key, label }) => {
                    const val = (editCssVars[key] ?? (DEFAULT_CSS_VARIABLES as any)[key]) as string;
                    const isCustom = key in editCssVars;
                    return (
                      <div key={key} className="mb-3">
                        <label className="flex items-center justify-between text-xs font-medium text-gray-400 mb-1">
                          {label}
                          {isCustom && <button onClick={() => resetCssVar(key)} className="text-[10px] text-gray-600 hover:text-gray-400">재설정</button>}
                        </label>
                        <input type="text" value={val} onChange={(e) => updateCssVar(key, e.target.value)}
                          className="w-full border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono bg-gray-800 text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── 스킨 패널 ─── */}
            {panel === 'skin' && (
              <div className="p-4 space-y-2">
                {theme.skins.length === 0 ? (
                  <div className="text-center py-10 text-gray-600">
                    <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm text-gray-500">스킨 없음</p>
                    <p className="text-xs mt-1 text-gray-700">ZIP 내 <code>skins/*.css</code>로 추가</p>
                  </div>
                ) : (
                  [{ slug: '', name: '기본 스킨' }, ...theme.skins].map((sk) => (
                    <button key={sk.slug} onClick={() => { setEditSkin(sk.slug); dirty(); }}
                      className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-colors ${editSkin === sk.slug ? 'border-blue-500 bg-blue-600/20 text-blue-400 font-medium' : 'border-gray-700 hover:bg-gray-800 text-gray-400'}`}>
                      {sk.name}
                      {editSkin === sk.slug && <CheckCircle className="h-4 w-4 text-blue-500" />}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* ─── 스크립트 패널 ─── */}
            {panel === 'scripts' && (
              <ScriptManager scripts={editScripts} onChange={(s) => { setEditScripts(s); dirty(); }} />
            )}

            {/* ─── CSS 패널 ─── */}
            {panel === 'css' && (
              <div className="p-4 flex flex-col gap-2" style={{ height: 'calc(100vh - 100px)' }}>
                <p className="text-xs text-gray-500">theme.css 위에 덮어씌울 추가 스타일.</p>
                <textarea value={editCss} onChange={(e) => { setEditCss(e.target.value); dirty(); }}
                  spellCheck={false} placeholder={`.hero { background: #000; }`}
                  className="flex-1 w-full border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono bg-gray-900 text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
              </div>
            )}

          </div>
        </div>

        {/* ════ MAIN AREA ════ */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {showPreview ? (
            /* ── 미리보기 ── */
            <div className="flex-1 overflow-auto bg-gray-600 flex flex-col items-center py-6 px-4">
              <div className="text-[10px] text-gray-400 mb-3">{device === 'mobile' ? '📱 390px' : '🖥 데스크탑'}</div>
              <div className={`bg-white shadow-2xl overflow-hidden tep ${device === 'mobile' ? 'w-[390px] rounded-3xl border-[6px] border-gray-800' : 'w-full max-w-[1280px] rounded-lg'}`}>
                {hasHeaderTemplate && (
                  <ThemeSection htmlUrl={theme.sectionHtmlUrls['header']} rawHtml={htmlMap['header']} settings={editSettings} className="w-full" />
                )}
                {editSections.filter((s) => s.enabled).map((sec) => (
                  <ThemeSection key={sec.id} htmlUrl={sec.htmlUrl} rawHtml={htmlMap[sec.id]} settings={editSettings} className="w-full" />
                ))}
                {hasFooterTemplate && (
                  <ThemeSection htmlUrl={theme.sectionHtmlUrls['footer']} rawHtml={htmlMap['footer']} settings={editSettings} className="w-full" />
                )}
              </div>
            </div>
          ) : (
            /* ── Monaco 코드 에디터 ── */
            <>
              {!editingId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-700 select-none bg-[#1e1e1e]">
                  <FileCode className="h-16 w-16 mb-4 opacity-10" />
                  <p className="text-sm text-gray-600">파일을 선택하세요</p>
                  <p className="text-xs mt-2 text-gray-700 text-center leading-relaxed">
                    좌측 섹션 패널에서<br />파일 이름을 클릭하세요
                  </p>
                </div>
              ) : htmlLoading ? (
                <div className="flex-1 flex items-center justify-center bg-[#1e1e1e]">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                </div>
              ) : (
                <Editor
                  height="100%"
                  language="html"
                  theme="vs-dark"
                  value={htmlMap[editingId] ?? ''}
                  onChange={(val) => {
                    if (val !== undefined) setHtmlMap((p) => ({ ...p, [editingId]: val }));
                  }}
                  options={{
                    fontSize: 13,
                    lineHeight: 22,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
                    fontLigatures: true,
                    minimap: { enabled: true, scale: 1 },
                    scrollBeyondLastLine: false,
                    wordWrap: 'off',
                    tabSize: 2,
                    insertSpaces: true,
                    padding: { top: 16, bottom: 16 },
                    renderLineHighlight: 'line',
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    smoothScrolling: true,
                    automaticLayout: true,
                    bracketPairColorization: { enabled: true },
                    guides: { bracketPairs: true, indentation: true },
                    formatOnPaste: true,
                  }}
                  loading={
                    <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-gray-600 text-sm gap-2">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                      에디터 초기화 중...
                    </div>
                  }
                />
              )}
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-xl border border-gray-700">
          {toast}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SectionFileRow — 고정 섹션 (header/footer)
// ============================================================
function SectionFileRow({ id, label, editingId, onEdit }: {
  id: string; label: string; editingId: string | null; onEdit: (id: string) => void;
}) {
  const active = editingId === id;
  return (
    <button onClick={() => onEdit(id)}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${active ? 'bg-blue-600/20 text-blue-300' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}>
      <File className="h-3 w-3 opacity-50 flex-shrink-0" />
      <span className="font-mono flex-1 text-left">{label}</span>
    </button>
  );
}

// ============================================================
// DraggableSectionRow — 드래그 + 토글 섹션
// ============================================================
function DraggableSectionRow({ sec, globalIdx, editingId, onEdit, onToggle, onDragStart, onDragOver, onDragEnd }: {
  sec: { id: string; title: string; enabled: boolean };
  globalIdx: number;
  editingId: string | null;
  onEdit: (id: string) => void;
  onToggle: (id: string) => void;
  onDragStart: (i: number) => void;
  onDragOver: (e: React.DragEvent, i: number) => void;
  onDragEnd: () => void;
}) {
  const active = editingId === sec.id;
  return (
    <div
      draggable
      onDragStart={() => onDragStart(globalIdx)}
      onDragOver={(e) => onDragOver(e, globalIdx)}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-1.5 px-2 py-1.5 text-xs transition-colors cursor-pointer select-none ${active ? 'bg-blue-600/20 text-blue-300' : !sec.enabled ? 'text-gray-700 hover:bg-gray-800' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
      onClick={() => onEdit(sec.id)}
    >
      <GripVertical className="h-3.5 w-3.5 text-gray-700 cursor-grab flex-shrink-0" />
      <File className="h-3 w-3 opacity-40 flex-shrink-0" />
      <span className={`font-mono flex-1 ${!sec.enabled ? 'line-through opacity-40' : ''}`}>{sec.id}.html</span>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(sec.id); }}
        className="flex-shrink-0 p-0.5"
        title={sec.enabled ? '비활성화' : '활성화'}
      >
        {sec.enabled
          ? <ToggleRight className="h-4 w-4 text-green-500" />
          : <ToggleLeft className="h-4 w-4 text-gray-700" />}
      </button>
    </div>
  );
}
