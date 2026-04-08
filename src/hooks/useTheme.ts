/**
 * useTheme - 테마 컨텍스트 접근 훅 (re-export)
 * theme-context.tsx의 ThemeConfigProvider가 실제 로직을 담당합니다.
 */

export {
  useThemeConfig as useTheme,
  useHeaderStyle,
  useFooterStyle,
  useProductCardStyle,
  useProductGridStyle,
  useHomeSections,
} from '@/lib/theme/theme-context';

export type { ActiveTheme, ThemeLayoutConfig, ThemeScript, ThemeSkinInfo } from '@/lib/theme/types';
