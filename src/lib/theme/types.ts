/**
 * Freecart 테마 & 스킨 시스템 - 통합 타입 정의
 */

// =============================================================================
// 레이아웃 컴포넌트 타입
// =============================================================================

export type HeaderStyle = 'simple' | 'mega-menu' | 'minimal' | 'centered';
export type FooterStyle = 'simple' | 'three-column' | 'minimal' | 'newsletter';
export type ProductCardStyle = 'basic' | 'hover' | 'magazine' | 'minimal';
export type ProductGridStyle = 'grid-2' | 'grid-3' | 'grid-4' | 'grid-5' | 'slider' | 'masonry';
export type BannerStyle = 'fullwidth' | 'slider' | 'grid' | 'video';
export type SectionStyle = 'grid' | 'carousel' | 'tabs' | 'list';

// =============================================================================
// 홈 섹션 config
// =============================================================================

export interface HomeSectionConfig {
  id: string;
  type: 'banner' | 'products' | 'categories' | 'reviews' | 'brands' | 'custom';
  style: string;
  title?: string;
  enabled?: boolean;
  settings?: Record<string, any>;
}

// =============================================================================
// 레이아웃 config (DB layout_config 컬럼에 저장)
// =============================================================================

export interface ThemeLayoutConfig {
  // 헤더/푸터 (null = 미표시)
  header: HeaderStyle | null;
  footer: FooterStyle | null;

  // 상품 표시
  productCard: ProductCardStyle;
  productGrid: ProductGridStyle;

  // 메인페이지 섹션 배치
  homeSections: HomeSectionConfig[];

  // 상세 설정
  settings: {
    headerFixed: boolean;
    showBreadcrumb: boolean;
    sidebarPosition: 'left' | 'right' | 'none';
    productImageRatio: '1:1' | '4:3' | '3:4';
  };
}

export const DEFAULT_LAYOUT_CONFIG: ThemeLayoutConfig = {
  header: 'simple',
  footer: 'three-column',
  productCard: 'hover',
  productGrid: 'grid-4',
  homeSections: [
    { id: 'main-banner', type: 'banner', style: 'slider', enabled: true },
    { id: 'new-products', type: 'products', style: 'grid', title: '신상품', enabled: true },
    { id: 'best-products', type: 'products', style: 'carousel', title: '베스트', enabled: true },
    { id: 'reviews', type: 'reviews', style: 'carousel', title: '고객 후기', enabled: true },
  ],
  settings: {
    headerFixed: true,
    showBreadcrumb: true,
    sidebarPosition: 'none',
    productImageRatio: '1:1',
  },
};

// =============================================================================
// 스크립트 타입
// =============================================================================

export type ScriptPosition = 'head' | 'body-start' | 'body-end';
export type ScriptEvent =
  | 'page-load'
  | 'product-view'
  | 'product-add'
  | 'cart-open'
  | 'checkout-start'
  | 'checkout-complete'
  | 'search';

export interface ThemeScript {
  id: string;
  name: string;
  src?: string;        // 외부 JS URL (CDN 등)
  content?: string;   // 인라인 JS
  position: ScriptPosition;
  events?: ScriptEvent[];
  enabled?: boolean;
}

// =============================================================================
// 스킨 타입
// =============================================================================

export interface ThemeSkinInfo {
  slug: string;
  name: string;
  cssUrl?: string;    // Supabase Storage URL
  default?: boolean;
}

// =============================================================================
// 활성 테마 (DB installed_themes에서 로드한 전체 정보)
// =============================================================================

export interface ActiveTheme {
  id: string;
  slug: string;
  name: string;
  version: string;

  // 레이아웃 구조
  layoutConfig: ThemeLayoutConfig;

  // CSS
  cssUrl?: string;                               // Supabase Storage theme.css
  customCss?: string;                            // 인라인 CSS
  cssVariables?: Partial<ThemeCssVariables>;     // CSS 변수 오버라이드

  // 스크립트
  scripts: ThemeScript[];

  // 스킨
  activeSkinSlug?: string;
  skins: ThemeSkinInfo[];

  // HTML 템플릿 섹션 (섹션ID → Storage URL)
  // 예: { "hero": "https://.../hero.html", "promo": "https://.../promo.html" }
  sectionHtmlUrls: Record<string, string>;

  // 테마 설정값 (관리자가 입력한 변수 값)
  // 예: { "hero_title": "최고의 쇼핑", "hero_bg": "https://..." }
  themeSettings: Record<string, string>;

  // 설정 스키마 (settings.json 파싱 결과 — 어떤 변수가 있는지 정의)
  settingsSchema: import('./template-engine').ThemeSettingsSchema;
}

// =============================================================================
// CSS 변수 (색상/폰트 등)
// =============================================================================

export interface ThemeCssVariables {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textMuted: string;
  bg: string;
  bgSecondary: string;
  headerBg: string;
  headerText: string;
  headerHeight: string;
  btnBg: string;
  btnText: string;
  btnRadius: string;
  cardRadius: string;
  font: string;
  fontHeading: string;
  maxWidth: string;
}

export const DEFAULT_CSS_VARIABLES: ThemeCssVariables = {
  primary: '#000000',
  secondary: '#4B5563',
  accent: '#EF4444',
  text: '#111827',
  textMuted: '#6B7280',
  bg: '#FFFFFF',
  bgSecondary: '#F9FAFB',
  headerBg: '#FFFFFF',
  headerText: '#111827',
  headerHeight: '64px',
  btnBg: '#000000',
  btnText: '#FFFFFF',
  btnRadius: '4px',
  cardRadius: '8px',
  font: 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif',
  fontHeading: 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif',
  maxWidth: '1280px',
};

// =============================================================================
// Theme Context 값
// =============================================================================

export interface ThemeContextValue {
  activeTheme: ActiveTheme | null;
  layoutConfig: ThemeLayoutConfig;
  loading: boolean;
  error: string | null;

  // 액션
  activateTheme: (themeId: string) => Promise<void>;
  activateSkin: (skinSlug: string) => Promise<void>;
  updateLayoutConfig: (config: Partial<ThemeLayoutConfig>) => Promise<void>;
  updateCustomCss: (css: string) => Promise<void>;
  updateCssVariables: (vars: Partial<ThemeCssVariables>) => Promise<void>;
  updateScripts: (scripts: ThemeScript[]) => Promise<void>;
  /** 테마 설정값 업데이트 (HTML 템플릿 변수) */
  updateThemeSettings: (settings: Record<string, string>) => Promise<void>;
  refreshTheme: () => Promise<void>;
}
