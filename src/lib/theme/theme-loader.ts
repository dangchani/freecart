/**
 * ThemeLoader - 런타임 CSS/JS/스킨 동적 로더
 * 빌드 없이 테마 전환을 즉시 적용합니다.
 */

import type { ThemeScript, ThemeCssVariables, ThemeSkinInfo } from './types';

// DOM 요소 ID 상수
const THEME_CSS_ID = 'freecart-theme-css';
const SKIN_CSS_ID = 'freecart-skin-css';
const CUSTOM_CSS_ID = 'freecart-custom-css';
const SCRIPT_PREFIX = 'freecart-script-';

// =============================================================================
// CSS 로드
// =============================================================================

/**
 * 테마 CSS 파일 로드 (Supabase Storage URL)
 */
export function loadThemeCSS(cssUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 기존 테마 CSS 제거
    removeElement(THEME_CSS_ID);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl;
    link.id = THEME_CSS_ID;
    link.onload = () => resolve();
    link.onerror = () => {
      console.warn('[ThemeLoader] theme.css 로드 실패:', cssUrl);
      resolve(); // 실패해도 앱은 계속 동작
    };
    document.head.appendChild(link);
  });
}

/**
 * 스킨 CSS 로드 (theme.css 위에 덮어씀)
 */
export function loadSkinCSS(skin: ThemeSkinInfo): Promise<void> {
  return new Promise((resolve, reject) => {
    removeElement(SKIN_CSS_ID);
    if (!skin.cssUrl) { resolve(); return; }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = skin.cssUrl;
    link.id = SKIN_CSS_ID;
    link.onload = () => resolve();
    link.onerror = () => {
      console.warn('[ThemeLoader] skin.css 로드 실패:', skin.cssUrl);
      resolve();
    };
    document.head.appendChild(link);
  });
}

/**
 * 커스텀 인라인 CSS 적용 (관리자 직접 입력 - 최우선)
 */
export function applyCustomCSS(css: string) {
  removeElement(CUSTOM_CSS_ID);
  if (!css?.trim()) return;

  const style = document.createElement('style');
  style.id = CUSTOM_CSS_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * 모든 테마 CSS 제거
 */
export function removeAllThemeCSS() {
  removeElement(THEME_CSS_ID);
  removeElement(SKIN_CSS_ID);
  removeElement(CUSTOM_CSS_ID);
}

// =============================================================================
// CSS 변수 적용
// =============================================================================

/**
 * :root CSS 변수 일괄 적용
 */
export function applyCssVariables(vars: Partial<ThemeCssVariables>) {
  const root = document.documentElement;
  const map: Record<keyof ThemeCssVariables, string> = {
    primary: '--theme-primary',
    secondary: '--theme-secondary',
    accent: '--theme-accent',
    text: '--theme-text',
    textMuted: '--theme-text-muted',
    bg: '--theme-bg',
    bgSecondary: '--theme-bg-secondary',
    headerBg: '--theme-header-bg',
    headerText: '--theme-header-text',
    headerHeight: '--theme-header-height',
    btnBg: '--theme-btn-bg',
    btnText: '--theme-btn-text',
    btnRadius: '--theme-btn-radius',
    cardRadius: '--theme-card-radius',
    font: '--theme-font',
    fontHeading: '--theme-font-heading',
    maxWidth: '--theme-max-width',
  };

  (Object.keys(vars) as Array<keyof ThemeCssVariables>).forEach((key) => {
    const value = vars[key];
    if (value && map[key]) {
      root.style.setProperty(map[key], value);
    }
  });
}

/**
 * CSS 변수 초기화
 */
export function clearCssVariables() {
  const root = document.documentElement;
  const vars = [
    '--theme-primary', '--theme-secondary', '--theme-accent',
    '--theme-text', '--theme-text-muted', '--theme-bg', '--theme-bg-secondary',
    '--theme-header-bg', '--theme-header-text', '--theme-header-height',
    '--theme-btn-bg', '--theme-btn-text', '--theme-btn-radius',
    '--theme-card-radius', '--theme-font', '--theme-font-heading', '--theme-max-width',
  ];
  vars.forEach((v) => root.style.removeProperty(v));
}

// =============================================================================
// 스크립트 주입
// =============================================================================

/**
 * 테마 스크립트 전체 주입
 * position: 'head' | 'body-start' | 'body-end'
 */
export function injectThemeScripts(scripts: ThemeScript[]) {
  // 기존 테마 스크립트 전체 제거
  removeAllThemeScripts();

  const enabled = scripts.filter((s) => s.enabled !== false);

  enabled.forEach((script) => {
    injectScript(script);
  });
}

/**
 * 인라인 스크립트 기본 검증
 * HTML 태그 삽입, data: URL 등 명백한 악의적 패턴 차단
 */
function validateScriptContent(content: string): boolean {
  // <script>, <iframe> 등 HTML 태그 삽입 차단
  if (/<[a-zA-Z]/.test(content)) return false;
  // data: URL 차단
  if (/data\s*:/i.test(content)) return false;
  // javascript: URL 차단
  if (/javascript\s*:/i.test(content)) return false;
  return true;
}

function injectScript(script: ThemeScript) {
  // 인라인 스크립트 검증
  if (script.content && !validateScriptContent(script.content)) {
    console.warn(`[ThemeLoader] 스크립트 "${script.name}" 차단됨: 허용되지 않는 패턴 포함`);
    return;
  }

  const el = document.createElement('script');
  el.id = `${SCRIPT_PREFIX}${script.id}`;
  el.setAttribute('data-theme-script', 'true');

  if (script.src) {
    // 외부 URL은 https:// 만 허용
    if (!script.src.startsWith('https://')) {
      console.warn(`[ThemeLoader] 스크립트 "${script.name}" 차단됨: HTTPS 외부 URL만 허용`);
      return;
    }
    el.src = script.src;
    el.async = true;
  } else if (script.content) {
    el.textContent = script.content;
  } else {
    return;
  }

  switch (script.position) {
    case 'head':
      document.head.appendChild(el);
      break;
    case 'body-start':
      document.body.insertBefore(el, document.body.firstChild);
      break;
    case 'body-end':
    default:
      document.body.appendChild(el);
      break;
  }
}

/**
 * 모든 테마 스크립트 제거
 */
export function removeAllThemeScripts() {
  document.querySelectorAll('[data-theme-script="true"]').forEach((el) => el.remove());
}

// =============================================================================
// Freecart 커스텀 이벤트 디스패치
// =============================================================================

export function dispatchThemeEvent(
  eventName: string,
  detail?: Record<string, any>
) {
  const event = new CustomEvent(`freecart:${eventName}`, {
    detail: detail || {},
    bubbles: true,
  });
  document.dispatchEvent(event);
}

// =============================================================================
// 페이지 스킨 CSS 로드
// =============================================================================

const PAGE_SKIN_PREFIX = 'freecart-page-skin-';

/**
 * 페이지 스킨 CSS 로드 (타입별 단독 관리)
 * id: freecart-page-skin-{type}
 */
export function loadPageSkinCSS(type: string, cssUrl: string): Promise<void> {
  return new Promise((resolve) => {
    const id = `${PAGE_SKIN_PREFIX}${type}`;
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl;
    link.id = id;
    link.onload = () => resolve();
    link.onerror = () => { console.warn(`[ThemeLoader] 페이지 스킨 CSS 로드 실패: ${cssUrl}`); resolve(); };
    document.head.appendChild(link);
  });
}

/**
 * 모든 페이지 스킨 CSS 제거
 */
export function removeAllPageSkinCSS() {
  document.querySelectorAll(`[id^="${PAGE_SKIN_PREFIX}"]`).forEach((el) => el.remove());
}

// =============================================================================
// 유틸
// =============================================================================

function removeElement(id: string) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

/**
 * 테마 전체 정리 (테마 전환 시 호출)
 */
export function clearAllTheme() {
  removeAllThemeCSS();
  removeAllThemeScripts();
  clearCssVariables();
  document.body.removeAttribute('data-theme');
  document.body.removeAttribute('data-skin');
  document.body.classList.remove('theme-loading');
}
