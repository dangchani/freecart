/**
 * Theme Context - DB 기반 테마 전역 상태 관리
 * localStorage 대신 Supabase installed_themes에서 로드합니다.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  type ActiveTheme,
  type ThemeLayoutConfig,
  type ThemeSkinInfo,
  type ThemeContextValue,
  type ThemeScript,
  type ThemeCssVariables,
  DEFAULT_LAYOUT_CONFIG,
} from './types';
import {
  loadThemeCSS,
  loadSkinCSS,
  applyCustomCSS,
  applyCssVariables,
  clearCssVariables,
  injectThemeScripts,
  removeAllThemeScripts,
  clearAllTheme,
  dispatchThemeEvent,
  loadPageSkinCSS,
  removeAllPageSkinCSS,
} from './theme-loader';

// =============================================================================
// Context
// =============================================================================

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// =============================================================================
// DB 데이터 → ActiveTheme 변환
// =============================================================================

function rowToActiveTheme(row: any, skins: any[]): ActiveTheme {
  const layoutConfig: ThemeLayoutConfig = {
    ...DEFAULT_LAYOUT_CONFIG,
    ...(row.layout_config || {}),
    settings: {
      ...DEFAULT_LAYOUT_CONFIG.settings,
      ...(row.layout_config?.settings || {}),
    },
  };

  const skinInfos: ThemeSkinInfo[] = skins.map((s: any) => ({
    slug: s.slug,
    name: s.name,
    cssUrl: s.css_url || undefined,
    default: false,
  }));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    version: row.version,
    layoutConfig,
    cssUrl: row.css_url || undefined,
    customCss: row.custom_css || undefined,
    cssVariables: row.css_variables || undefined,
    scripts: Array.isArray(row.scripts) ? row.scripts : [],
    activeSkinSlug: row.active_skin_slug || undefined,
    skins: skinInfos,
    sectionHtmlUrls: row.section_html_urls || {},
    themeSettings: row.theme_settings || {},
    settingsSchema: row.settings_schema || {},
  };
}

// =============================================================================
// Provider
// =============================================================================

export function ThemeConfigProvider({ children }: { children: ReactNode }) {
  const [activeTheme, setActiveTheme] = useState<ActiveTheme | null>(null);
  const [layoutConfig, setLayoutConfig] = useState<ThemeLayoutConfig>(DEFAULT_LAYOUT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [htmlCacheVersion, setHtmlCacheVersion] = useState(() => Date.now());

  // 다른 탭에서 HTML 저장 시 → 타임스탬프 수신해서 즉시 적용
  useEffect(() => {
    const ch = new BroadcastChannel('fc-html-update');
    ch.onmessage = (e: MessageEvent<number>) => setHtmlCacheVersion(e.data);
    return () => ch.close();
  }, []);

  // ------------------------------------------------------------------
  // 테마 로드
  // ------------------------------------------------------------------
  const loadTheme = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      // 활성 테마 조회 (unique constraint로 1개만 보장)
      const { data: themeRow, error: themeErr } = await supabase
        .from('installed_themes')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (themeErr) throw themeErr;

      if (!themeRow) {
        // 활성 테마 없음 → 기본값 사용
        clearAllTheme();
        setActiveTheme(null);
        setLayoutConfig(DEFAULT_LAYOUT_CONFIG);
        return;
      }

      // 해당 테마의 스킨 목록 조회
      const { data: skinsData } = await supabase
        .from('skins')
        .select('slug, name, css_url')
        .eq('theme_id', themeRow.id)
        .order('installed_at', { ascending: true });

      const theme = rowToActiveTheme(themeRow, skinsData || []);
      setActiveTheme(theme);
      setLayoutConfig(theme.layoutConfig);

      // ------ CSS 로드 순서: theme.css → skin.css → custom_css ------
      clearAllTheme();
      document.body.setAttribute('data-theme', theme.slug);

      // 1. theme.css
      if (theme.cssUrl) {
        await loadThemeCSS(theme.cssUrl);
      }

      // 2. skin.css
      if (theme.activeSkinSlug) {
        const skinInfo = theme.skins.find((s) => s.slug === theme.activeSkinSlug);
        if (skinInfo) {
          await loadSkinCSS(skinInfo);
          document.body.setAttribute('data-skin', theme.activeSkinSlug);
        }
      }

      // 3. CSS 변수 오버라이드
      if (theme.cssVariables && Object.keys(theme.cssVariables).length > 0) {
        applyCssVariables(theme.cssVariables);
      } else {
        clearCssVariables();
      }

      // 4. custom_css (최우선)
      if (theme.customCss) {
        applyCustomCSS(theme.customCss);
      }

      // 4. 스크립트 주입
      if (theme.scripts.length > 0) {
        injectThemeScripts(theme.scripts);
      }

      // 5. 활성 페이지 스킨 CSS 일괄 로드 (theme_id 없는 스킨)
      const { data: pageSkins } = await supabase
        .from('skins')
        .select('type, css_url')
        .is('theme_id', null)
        .eq('is_active', true)
        .not('css_url', 'is', null);

      removeAllPageSkinCSS();
      if (pageSkins && pageSkins.length > 0) {
        await Promise.all(
          pageSkins.map((s: any) => loadPageSkinCSS(s.type, s.css_url))
        );
      }

      dispatchThemeEvent('page-load');
    } catch (err) {
      console.error('[ThemeContext] 테마 로드 실패:', err);
      setError(err instanceof Error ? err.message : '테마 로드 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTheme();
  }, [loadTheme]);

  // ------------------------------------------------------------------
  // 테마 활성화
  // ------------------------------------------------------------------
  const activateTheme = useCallback(async (themeId: string) => {
    const supabase = createClient();

    // unique partial index가 있으므로 순서 중요:
    // 1) 현재 활성 테마 비활성화
    await supabase
      .from('installed_themes')
      .update({ is_active: false })
      .eq('is_active', true);

    // 2) 새 테마 활성화
    const { error } = await supabase
      .from('installed_themes')
      .update({ is_active: true, activated_at: new Date().toISOString() })
      .eq('id', themeId);

    if (error) throw error;

    await loadTheme();
  }, [loadTheme]);

  // ------------------------------------------------------------------
  // 스킨 변경
  // ------------------------------------------------------------------
  const activateSkin = useCallback(async (skinSlug: string) => {
    if (!activeTheme) return;
    const supabase = createClient();

    const { error } = await supabase
      .from('installed_themes')
      .update({ active_skin_slug: skinSlug })
      .eq('id', activeTheme.id);

    if (error) throw error;

    // 스킨 CSS만 교체 (테마 전체 리로드 불필요)
    const skinInfo = activeTheme.skins.find((s) => s.slug === skinSlug);
    if (skinInfo) {
      await loadSkinCSS(skinInfo);
      document.body.setAttribute('data-skin', skinSlug);
    }

    setActiveTheme((prev) =>
      prev ? { ...prev, activeSkinSlug: skinSlug } : prev
    );
  }, [activeTheme]);

  // ------------------------------------------------------------------
  // Layout config 업데이트
  // ------------------------------------------------------------------
  const updateLayoutConfig = useCallback(async (config: Partial<ThemeLayoutConfig>) => {
    if (!activeTheme) return;
    const supabase = createClient();

    const newConfig = {
      ...layoutConfig,
      ...config,
      settings: {
        ...layoutConfig.settings,
        ...config.settings,
      },
    };

    const { error } = await supabase
      .from('installed_themes')
      .update({ layout_config: newConfig })
      .eq('id', activeTheme.id);

    if (error) throw error;
    setLayoutConfig(newConfig);
    setActiveTheme((prev) =>
      prev ? { ...prev, layoutConfig: newConfig } : prev
    );
  }, [activeTheme, layoutConfig]);

  // ------------------------------------------------------------------
  // Custom CSS 업데이트
  // ------------------------------------------------------------------
  const updateCustomCss = useCallback(async (css: string) => {
    if (!activeTheme) return;
    const supabase = createClient();

    const { error } = await supabase
      .from('installed_themes')
      .update({ custom_css: css })
      .eq('id', activeTheme.id);

    if (error) throw error;
    applyCustomCSS(css);
    setActiveTheme((prev) => prev ? { ...prev, customCss: css } : prev);
  }, [activeTheme]);

  // ------------------------------------------------------------------
  // CSS 변수 업데이트
  // ------------------------------------------------------------------
  const updateCssVariables = useCallback(async (vars: Partial<ThemeCssVariables>) => {
    if (!activeTheme) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('installed_themes')
      .update({ css_variables: vars })
      .eq('id', activeTheme.id);
    if (error) throw error;
    applyCssVariables(vars);
    setActiveTheme((prev) => prev ? { ...prev, cssVariables: vars } : prev);
  }, [activeTheme]);

  // ------------------------------------------------------------------
  // 스크립트 업데이트 (DB 저장 + 재주입)
  // ------------------------------------------------------------------
  const updateScripts = useCallback(async (scripts: ThemeScript[]) => {
    if (!activeTheme) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('installed_themes')
      .update({ scripts })
      .eq('id', activeTheme.id);
    if (error) throw error;
    // 기존 스크립트 제거 후 재주입
    removeAllThemeScripts();
    injectThemeScripts(scripts);
    setActiveTheme((prev) => prev ? { ...prev, scripts } : prev);
  }, [activeTheme]);

  // ------------------------------------------------------------------
  // 테마 설정값 업데이트 (HTML 템플릿 변수)
  // ------------------------------------------------------------------
  const updateThemeSettings = useCallback(async (settings: Record<string, string>) => {
    if (!activeTheme) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('installed_themes')
      .update({ theme_settings: settings })
      .eq('id', activeTheme.id);
    if (error) throw error;
    setActiveTheme((prev) => prev ? { ...prev, themeSettings: settings } : prev);
  }, [activeTheme]);

  const refreshTheme = useCallback(async () => {
    await loadTheme();
    const ts = Date.now();
    setHtmlCacheVersion(ts);              // 자신 탭
    const ch = new BroadcastChannel('fc-html-update');
    ch.postMessage(ts);                   // 다른 탭 — 같은 타임스탬프로 동기화
    ch.close();
  }, [loadTheme]);

  return (
    <ThemeContext.Provider value={{
      activeTheme,
      layoutConfig,
      loading,
      error,
      htmlCacheVersion,
      activateTheme,
      activateSkin,
      updateLayoutConfig,
      updateCustomCss,
      updateCssVariables,
      updateScripts,
      updateThemeSettings,
      refreshTheme,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

// =============================================================================
// Hooks
// =============================================================================

export function useThemeConfig() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeConfig must be used within ThemeConfigProvider');
  return ctx;
}

export function useHeaderStyle() {
  const { layoutConfig } = useThemeConfig();
  return layoutConfig.header;
}

export function useFooterStyle() {
  const { layoutConfig } = useThemeConfig();
  return layoutConfig.footer;
}

export function useProductCardStyle() {
  const { layoutConfig } = useThemeConfig();
  return layoutConfig.productCard;
}

export function useProductGridStyle() {
  const { layoutConfig } = useThemeConfig();
  return layoutConfig.productGrid;
}

export function useHomeSections() {
  const { layoutConfig } = useThemeConfig();
  return layoutConfig.homeSections.filter((s) => s.enabled !== false);
}
