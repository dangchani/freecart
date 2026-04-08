/**
 * Theme System - Public API
 */

// Types
export type {
  HeaderStyle,
  FooterStyle,
  ProductCardStyle,
  ProductGridStyle,
  BannerStyle,
  SectionStyle,
  ThemeLayoutConfig,
  HomeSectionConfig,
  ThemeScript,
  ThemeSkinInfo,
  ActiveTheme,
  ThemeCssVariables,
  ThemeContextValue,
} from './types';

export { DEFAULT_LAYOUT_CONFIG, DEFAULT_CSS_VARIABLES } from './types';

// Backward compatibility
export { DEFAULT_THEME_CONFIG } from './component-registry';

// Component Registry
export {
  COMPONENT_REGISTRY,
  COMPONENT_META,
  getHeaderComponent,
  getFooterComponent,
  getProductCardComponent,
  getProductGridComponent,
  getBannerComponent,
  getSectionComponent,
} from './component-registry';

// Context & Hooks
export {
  ThemeConfigProvider,
  useThemeConfig,
  useHeaderStyle,
  useFooterStyle,
  useProductCardStyle,
  useProductGridStyle,
  useHomeSections,
} from './theme-context';

// Template Engine
export {
  renderTemplate,
  fetchAndRenderTemplate,
  parseSettingsSchema,
  extractDefaultSettings,
} from './template-engine';
export type {
  ThemeSettings,
  SettingType,
  SettingItem,
  SettingsSection,
  ThemeSettingsSchema,
} from './template-engine';

// Loader utilities
export {
  loadThemeCSS,
  loadSkinCSS,
  applyCustomCSS,
  injectThemeScripts,
  applyCssVariables,
  clearCssVariables,
  clearAllTheme,
  dispatchThemeEvent,
  loadPageSkinCSS,
  removeAllPageSkinCSS,
} from './theme-loader';
