/**
 * ThemeLayout - 테마 레이아웃 래퍼
 * sectionHtmlUrls에 header/footer.html이 있으면 HTML 템플릿 우선 렌더링.
 * 없으면 layout_config 기반 React 컴포넌트 폴백.
 */

import { Suspense, ReactNode } from 'react';
import { useThemeConfig } from '@/lib/theme/theme-context';
import { getHeaderComponent, getFooterComponent } from '@/lib/theme/component-registry';
import { ThemeSection } from '@/components/theme/ThemeSection';

interface Props {
  children: ReactNode;
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

const HeaderSkeleton = () => <div className="h-16 bg-white border-b animate-pulse" />;
const FooterSkeleton = () => <div className="h-48 bg-gray-100 animate-pulse" />;

export default function ThemeLayout({ children, siteName = 'Freecart', logo, companyInfo }: Props) {
  const { layoutConfig, activeTheme } = useThemeConfig();

  const htmlUrls = activeTheme?.sectionHtmlUrls ?? {};
  const settings = activeTheme?.themeSettings ?? {};

  const HeaderComponent = getHeaderComponent(layoutConfig.header);
  const FooterComponent = getFooterComponent(layoutConfig.footer);

  return (
    <div className="min-h-screen flex flex-col">
      {/* 헤더: HTML 템플릿 우선, 없으면 React 컴포넌트 */}
      {htmlUrls['header'] ? (
        <ThemeSection htmlUrl={htmlUrls['header']} settings={settings} />
      ) : HeaderComponent ? (
        <Suspense fallback={<HeaderSkeleton />}>
          <HeaderComponent siteName={siteName} logo={logo} />
        </Suspense>
      ) : null}

      {/* 메인 콘텐츠 */}
      <main className="flex-1">
        {children}
      </main>

      {/* 푸터: HTML 템플릿 우선, 없으면 React 컴포넌트 */}
      {htmlUrls['footer'] ? (
        <ThemeSection htmlUrl={htmlUrls['footer']} settings={settings} />
      ) : FooterComponent ? (
        <Suspense fallback={<FooterSkeleton />}>
          <FooterComponent siteName={siteName} companyInfo={companyInfo} />
        </Suspense>
      ) : null}
    </div>
  );
}
