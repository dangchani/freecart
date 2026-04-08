/**
 * ThemeProvider - 앱 루트에서 테마 시스템 초기화
 * ThemeConfigProvider를 래핑하여 앱 전체에 테마 컨텍스트를 제공합니다.
 */

import { ReactNode } from 'react';
import { ThemeConfigProvider } from '@/lib/theme/theme-context';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <ThemeConfigProvider>
      {children}
    </ThemeConfigProvider>
  );
}
