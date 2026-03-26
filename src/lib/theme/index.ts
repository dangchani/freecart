/**
 * Theme System Exports
 */

// Registry & Types
export {
  COMPONENT_REGISTRY,
  COMPONENT_META,
  DEFAULT_THEME_CONFIG,
  getHeaderComponent,
  getFooterComponent,
  getProductCardComponent,
  getProductGridComponent,
  getBannerComponent,
  getSectionComponent,
} from './component-registry';

export type {
  HeaderStyle,
  FooterStyle,
  ProductCardStyle,
  ProductGridStyle,
  BannerStyle,
  SectionStyle,
  ThemeLayoutConfig,
  HomeSectionConfig,
  ComponentMeta,
} from './component-registry';

// Context & Hooks
export {
  ThemeConfigProvider,
  useThemeConfig,
  useHeaderStyle,
  useFooterStyle,
  useProductCardStyle,
  useProductGridStyle,
} from './theme-context';
