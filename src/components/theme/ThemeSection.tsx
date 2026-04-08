/**
 * ThemeSection - HTML 템플릿 기반 섹션 렌더러
 * Storage에서 HTML을 가져와 변수 치환 후 렌더링합니다.
 * 테마 판매자가 자유롭게 구조를 설계할 수 있습니다.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAndRenderTemplate, renderTemplate } from '@/lib/theme/template-engine';
import type { ThemeSettings } from '@/lib/theme/template-engine';

interface ThemeSectionProps {
  /** Supabase Storage HTML URL */
  htmlUrl: string;
  /** 변수 치환에 사용할 settings */
  settings: ThemeSettings;
  /** 섹션 래퍼 className */
  className?: string;
  /** 로딩 중 fallback */
  fallback?: React.ReactNode;
  /** 관리자 편집 모드 (오버레이 표시) */
  editMode?: boolean;
  /** 섹션 이름 (편집 모드 라벨) */
  sectionName?: string;
  onEditClick?: () => void;
  /**
   * URL fetch를 건너뛰고 이 HTML을 직접 사용합니다.
   * 에디터에서 실시간 미리보기용.
   */
  rawHtml?: string;
}

export function ThemeSection({
  htmlUrl,
  settings,
  className,
  fallback,
  editMode,
  sectionName,
  onEditClick,
  rawHtml,
}: ThemeSectionProps) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // HTML fetch / 변수 치환
  useEffect(() => {
    if (rawHtml !== undefined) {
      setHtml(renderTemplate(rawHtml, settings));
      setLoading(false);
      setError('');
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError('');

    fetchAndRenderTemplate(htmlUrl, settings, ctrl.signal).then(({ html: rendered, error: err }) => {
      if (err === 'aborted') return;
      if (err) { setError(err); setLoading(false); return; }
      setHtml(rendered);
      setLoading(false);
    });

    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawHtml ?? htmlUrl, JSON.stringify(settings)]);

  // <a> 클릭 → React Router navigate (SPA 라우팅)
  useEffect(() => {
    if (!html || !containerRef.current) return;
    const container = containerRef.current;
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href === '#' || href.startsWith('http') ||
          href.startsWith('//') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      e.preventDefault();
      navigate(href);
    }
    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [html, navigate]);

  // ── early returns (모든 Hook 호출 뒤에 위치) ──
  if (loading) {
    return (
      <div className={className}>
        {fallback ?? <div className="w-full h-40 bg-gray-100 animate-pulse rounded" />}
      </div>
    );
  }

  if (error) {
    if (import.meta.env.DEV) {
      return (
        <div className={`${className} border-2 border-dashed border-red-300 bg-red-50 p-4 text-xs text-red-500 rounded`}>
          섹션 로드 실패: {error}<br /><span className="opacity-60">{htmlUrl}</span>
        </div>
      );
    }
    return null;
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      {/* HTML 템플릿 렌더링 — 테마 판매자 작성 HTML */}
      <div dangerouslySetInnerHTML={{ __html: html }} />

      {/* 편집 모드 오버레이 */}
      {editMode && (
        <div
          className="absolute inset-0 border-2 border-blue-400 border-dashed pointer-events-none"
          style={{ zIndex: 10 }}
        >
          <button
            onClick={onEditClick}
            className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded pointer-events-auto hover:bg-blue-700"
          >
            ✏️ {sectionName ?? '섹션'} 편집
          </button>
        </div>
      )}
    </div>
  );
}
