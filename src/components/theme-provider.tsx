/**
 * Theme Provider Component
 * 활성화된 테마를 로드하고 적용합니다.
 */

import { useEffect, ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { activeTheme, loading } = useTheme();

  useEffect(() => {
    // 테마 로딩 중일 때 body에 클래스 추가
    if (loading) {
      document.body.classList.add('theme-loading');
    } else {
      document.body.classList.remove('theme-loading');
    }
  }, [loading]);

  useEffect(() => {
    // 테마 이름을 body 속성에 추가 (디버깅용)
    if (activeTheme) {
      document.body.setAttribute('data-theme', activeTheme.slug);
    } else {
      document.body.removeAttribute('data-theme');
    }
  }, [activeTheme]);

  return <>{children}</>;
}
