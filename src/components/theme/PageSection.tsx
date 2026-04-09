/**
 * PageSection — 페이지별 테마 HTML 섹션 주입
 *
 * section_html_urls[id] 가 있을 때만 렌더링, 없으면 null 반환.
 * 템플릿 변수: {{site_name}}, {{site_description}}, {{logo_url}} 등 글로벌 설정 포함.
 */
import { useState, useEffect } from 'react';
import { useThemeConfig } from '@/lib/theme';
import { ThemeSection } from './ThemeSection';
import { getSettings } from '@/services/settings';

interface PageSectionProps {
  id: string;
  className?: string;
  /** 전체 페이지 모드 (배너가 아닌 페이지 전체를 교체) */
  fullPage?: boolean;
}

const GLOBAL_KEYS = ['site_name', 'site_description', 'logo_url', 'site_email', 'site_phone', 'site_address'];

export function PageSection({ id, className, fullPage }: PageSectionProps) {
  const { activeTheme, htmlCacheVersion } = useThemeConfig();
  const [globalSettings, setGlobalSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    getSettings(GLOBAL_KEYS).then(setGlobalSettings);
  }, []);

  const rawUrl = activeTheme?.sectionHtmlUrls?.[id];
  if (!rawUrl) return null;

  // htmlCacheVersion이 바뀌면 URL도 바뀌어 ThemeSection이 재fetch함
  const url = `${rawUrl}?v=${htmlCacheVersion}`;
  const settings = { ...globalSettings, ...(activeTheme?.themeSettings ?? {}) };
  return (
    <ThemeSection
      htmlUrl={url}
      settings={settings}
      className={fullPage ? 'min-h-screen' : className}
    />
  );
}
