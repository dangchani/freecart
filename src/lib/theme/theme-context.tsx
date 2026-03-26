/**
 * Theme Context
 * 테마 설정을 전역으로 관리합니다.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import {
  ThemeLayoutConfig,
  DEFAULT_THEME_CONFIG,
} from './component-registry';

// =============================================================================
// 타입 정의
// =============================================================================

interface ThemeContextValue {
  // 현재 테마 설정
  config: ThemeLayoutConfig;

  // 테마 설정 변경
  setConfig: (config: Partial<ThemeLayoutConfig>) => void;

  // 특정 설정 변경
  updateSetting: <K extends keyof ThemeLayoutConfig['settings']>(
    key: K,
    value: ThemeLayoutConfig['settings'][K]
  ) => void;

  // 기본값으로 리셋
  resetConfig: () => void;

  // 로딩 상태
  isLoading: boolean;

  // CSS 테마 변수
  cssVariables: CssVariables;
  setCssVariables: (variables: Partial<CssVariables>) => void;
}

interface CssVariables {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  fontFamily: string;
  borderRadius: string;
}

const defaultCssVariables: CssVariables = {
  primaryColor: '#000000',
  secondaryColor: '#4B5563',
  accentColor: '#EF4444',
  textColor: '#111827',
  backgroundColor: '#FFFFFF',
  fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, sans-serif',
  borderRadius: '0.5rem',
};

// =============================================================================
// Context 생성
// =============================================================================

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// =============================================================================
// Provider
// =============================================================================

const STORAGE_KEY = 'freecart_theme_config';
const CSS_STORAGE_KEY = 'freecart_css_variables';

interface ThemeProviderProps {
  children: ReactNode;
  initialConfig?: Partial<ThemeLayoutConfig>;
  initialCssVariables?: Partial<CssVariables>;
}

export function ThemeConfigProvider({
  children,
  initialConfig,
  initialCssVariables,
}: ThemeProviderProps) {
  const [config, setConfigState] = useState<ThemeLayoutConfig>(() => {
    // localStorage에서 저장된 설정 로드
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...DEFAULT_THEME_CONFIG,
            ...parsed,
            settings: {
              ...DEFAULT_THEME_CONFIG.settings,
              ...parsed.settings,
            },
          };
        }
      } catch (e) {
        console.error('Failed to load theme config:', e);
      }
    }
    return {
      ...DEFAULT_THEME_CONFIG,
      ...initialConfig,
      settings: {
        ...DEFAULT_THEME_CONFIG.settings,
        ...initialConfig?.settings,
      },
    };
  });

  const [cssVariables, setCssVariablesState] = useState<CssVariables>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(CSS_STORAGE_KEY);
        if (saved) {
          return { ...defaultCssVariables, ...JSON.parse(saved) };
        }
      } catch (e) {
        console.error('Failed to load CSS variables:', e);
      }
    }
    return { ...defaultCssVariables, ...initialCssVariables };
  });

  const [isLoading, setIsLoading] = useState(true);

  // CSS 변수를 DOM에 적용
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', cssVariables.primaryColor);
    root.style.setProperty('--color-secondary', cssVariables.secondaryColor);
    root.style.setProperty('--color-accent', cssVariables.accentColor);
    root.style.setProperty('--color-text', cssVariables.textColor);
    root.style.setProperty('--color-background', cssVariables.backgroundColor);
    root.style.setProperty('--font-family', cssVariables.fontFamily);
    root.style.setProperty('--border-radius', cssVariables.borderRadius);
  }, [cssVariables]);

  // 설정 변경 시 localStorage에 저장
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch (e) {
        console.error('Failed to save theme config:', e);
      }
    }
  }, [config]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(CSS_STORAGE_KEY, JSON.stringify(cssVariables));
      } catch (e) {
        console.error('Failed to save CSS variables:', e);
      }
    }
  }, [cssVariables]);

  // 초기 로딩 완료
  useEffect(() => {
    setIsLoading(false);
  }, []);

  const setConfig = useCallback((newConfig: Partial<ThemeLayoutConfig>) => {
    setConfigState((prev) => ({
      ...prev,
      ...newConfig,
      settings: {
        ...prev.settings,
        ...newConfig.settings,
      },
    }));
  }, []);

  const updateSetting = useCallback(<K extends keyof ThemeLayoutConfig['settings']>(
    key: K,
    value: ThemeLayoutConfig['settings'][K]
  ) => {
    setConfigState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [key]: value,
      },
    }));
  }, []);

  const resetConfig = useCallback(() => {
    setConfigState(DEFAULT_THEME_CONFIG);
    setCssVariablesState(defaultCssVariables);
  }, []);

  const setCssVariables = useCallback((variables: Partial<CssVariables>) => {
    setCssVariablesState((prev) => ({ ...prev, ...variables }));
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        config,
        setConfig,
        updateSetting,
        resetConfig,
        isLoading,
        cssVariables,
        setCssVariables,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useThemeConfig() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeConfig must be used within a ThemeConfigProvider');
  }
  return context;
}

// =============================================================================
// 편의 Hooks
// =============================================================================

export function useHeaderStyle() {
  const { config, setConfig } = useThemeConfig();
  return {
    style: config.header,
    setStyle: (style: ThemeLayoutConfig['header']) => setConfig({ header: style }),
  };
}

export function useFooterStyle() {
  const { config, setConfig } = useThemeConfig();
  return {
    style: config.footer,
    setStyle: (style: ThemeLayoutConfig['footer']) => setConfig({ footer: style }),
  };
}

export function useProductCardStyle() {
  const { config, setConfig } = useThemeConfig();
  return {
    style: config.productCard,
    setStyle: (style: ThemeLayoutConfig['productCard']) => setConfig({ productCard: style }),
  };
}

export function useProductGridStyle() {
  const { config, setConfig } = useThemeConfig();
  return {
    style: config.productGrid,
    setStyle: (style: ThemeLayoutConfig['productGrid']) => setConfig({ productGrid: style }),
  };
}
