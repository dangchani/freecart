/**
 * Theme Provider Hook
 * 활성화된 테마의 CSS를 동적으로 로드하고 적용합니다.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ActiveTheme {
  id: string;
  slug: string;
  name: string;
  cssUrl?: string;
  config?: ThemeConfig;
}

interface ThemeConfig {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  headerStyle?: 'fixed' | 'static';
  layoutType?: 'wide' | 'boxed';
  fontFamily?: string;
  customVariables?: Record<string, string>;
}

let themeStyleElement: HTMLStyleElement | null = null;
let themeLinkElement: HTMLLinkElement | null = null;

/**
 * 테마 CSS 변수 적용
 */
function applyThemeVariables(config: ThemeConfig) {
  const root = document.documentElement;

  if (config.primaryColor) {
    root.style.setProperty('--theme-primary', config.primaryColor);
  }
  if (config.secondaryColor) {
    root.style.setProperty('--theme-secondary', config.secondaryColor);
  }
  if (config.backgroundColor) {
    root.style.setProperty('--theme-bg', config.backgroundColor);
  }
  if (config.textColor) {
    root.style.setProperty('--theme-text', config.textColor);
  }
  if (config.fontFamily) {
    root.style.setProperty('--theme-font', config.fontFamily);
  }

  // 커스텀 변수 적용
  if (config.customVariables) {
    Object.entries(config.customVariables).forEach(([key, value]) => {
      root.style.setProperty(`--theme-${key}`, value);
    });
  }

  // 레이아웃 클래스 적용
  document.body.classList.remove('layout-wide', 'layout-boxed');
  if (config.layoutType) {
    document.body.classList.add(`layout-${config.layoutType}`);
  }

  document.body.classList.remove('header-fixed', 'header-static');
  if (config.headerStyle) {
    document.body.classList.add(`header-${config.headerStyle}`);
  }
}

/**
 * 외부 CSS 파일 로드
 */
function loadThemeCSS(cssUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 기존 테마 CSS 제거
    if (themeLinkElement) {
      themeLinkElement.remove();
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl;
    link.id = 'theme-css';

    link.onload = () => resolve();
    link.onerror = () => reject(new Error('Failed to load theme CSS'));

    document.head.appendChild(link);
    themeLinkElement = link;
  });
}

/**
 * 인라인 CSS 적용
 */
function applyInlineCSS(css: string) {
  if (themeStyleElement) {
    themeStyleElement.remove();
  }

  const style = document.createElement('style');
  style.id = 'theme-inline-css';
  style.textContent = css;
  document.head.appendChild(style);
  themeStyleElement = style;
}

/**
 * 테마 초기화 (제거)
 */
function clearTheme() {
  if (themeLinkElement) {
    themeLinkElement.remove();
    themeLinkElement = null;
  }
  if (themeStyleElement) {
    themeStyleElement.remove();
    themeStyleElement = null;
  }

  // CSS 변수 초기화
  const root = document.documentElement;
  root.style.removeProperty('--theme-primary');
  root.style.removeProperty('--theme-secondary');
  root.style.removeProperty('--theme-bg');
  root.style.removeProperty('--theme-text');
  root.style.removeProperty('--theme-font');

  document.body.classList.remove('layout-wide', 'layout-boxed', 'header-fixed', 'header-static');
}

/**
 * useTheme Hook
 */
export function useTheme() {
  const [activeTheme, setActiveTheme] = useState<ActiveTheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActiveTheme();
  }, []);

  async function loadActiveTheme() {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const { data, error: dbError } = await supabase
        .from('installed_themes')
        .select('id, slug, name, css_url, config')
        .eq('is_active', true)
        .single();

      if (dbError) {
        if (dbError.code === 'PGRST116') {
          // 활성 테마 없음 - 정상
          clearTheme();
          setActiveTheme(null);
          return;
        }
        throw dbError;
      }

      if (data) {
        const theme: ActiveTheme = {
          id: data.id,
          slug: data.slug,
          name: data.name,
          cssUrl: data.css_url,
          config: data.config,
        };

        setActiveTheme(theme);

        // 테마 적용
        if (theme.config) {
          applyThemeVariables(theme.config);
        }

        if (theme.cssUrl) {
          await loadThemeCSS(theme.cssUrl);
        }
      }
    } catch (err) {
      console.error('Failed to load active theme:', err);
      setError(err instanceof Error ? err.message : '테마 로드 실패');
    } finally {
      setLoading(false);
    }
  }

  async function refreshTheme() {
    clearTheme();
    await loadActiveTheme();
  }

  return {
    activeTheme,
    loading,
    error,
    refreshTheme,
    clearTheme,
  };
}

/**
 * 테마 미리보기 (임시 적용)
 */
export function previewTheme(config: ThemeConfig, css?: string) {
  if (config) {
    applyThemeVariables(config);
  }
  if (css) {
    applyInlineCSS(css);
  }
}

/**
 * 테마 미리보기 해제
 */
export function clearPreview() {
  clearTheme();
}

export type { ActiveTheme, ThemeConfig };
