/**
 * ThemeLayout - 테마 레이아웃 래퍼
 * Config 기반으로 헤더/푸터/레이아웃을 동적으로 렌더링합니다.
 */

import { Suspense, ReactNode } from 'react';
import {
  ThemeLayoutConfig,
  DEFAULT_THEME_CONFIG,
  getHeaderComponent,
  getFooterComponent,
} from '@/lib/theme/component-registry';

interface Props {
  children: ReactNode;
  config?: Partial<ThemeLayoutConfig>;
  siteName?: string;
  logo?: string;
  companyInfo?: {
    name?: string;
    ceo?: string;
    address?: string;
    tel?: string;
    email?: string;
    businessNumber?: string;
  };
}

// 로딩 폴백
const HeaderSkeleton = () => (
  <div className="h-16 bg-white border-b animate-pulse" />
);

const FooterSkeleton = () => (
  <div className="h-48 bg-gray-100 animate-pulse" />
);

export default function ThemeLayout({
  children,
  config,
  siteName = 'Freecart',
  logo,
  companyInfo,
}: Props) {
  // Config 병합
  const mergedConfig: ThemeLayoutConfig = {
    ...DEFAULT_THEME_CONFIG,
    ...config,
    settings: {
      ...DEFAULT_THEME_CONFIG.settings,
      ...config?.settings,
    },
  };

  // 컴포넌트 가져오기
  const HeaderComponent = getHeaderComponent(mergedConfig.header);
  const FooterComponent = getFooterComponent(mergedConfig.footer);

  return (
    <div className="min-h-screen flex flex-col">
      {/* 헤더 */}
      <Suspense fallback={<HeaderSkeleton />}>
        <HeaderComponent
          siteName={siteName}
          logo={logo}
        />
      </Suspense>

      {/* 메인 콘텐츠 */}
      <main className="flex-1">
        {mergedConfig.settings.showBreadcrumb && (
          <div className="max-w-7xl mx-auto px-4 py-2">
            {/* Breadcrumb은 별도 컴포넌트로 구현 */}
          </div>
        )}
        {children}
      </main>

      {/* 푸터 */}
      <Suspense fallback={<FooterSkeleton />}>
        <FooterComponent
          siteName={siteName}
          companyInfo={companyInfo}
        />
      </Suspense>
    </div>
  );
}
