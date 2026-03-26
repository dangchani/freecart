/**
 * Theme Component Registry
 * 모든 레이아웃 컴포넌트를 등록하고 관리합니다.
 * 테마 Config에서 컴포넌트 ID로 참조하여 런타임에 동적 렌더링합니다.
 */

import { ComponentType, lazy } from 'react';

// =============================================================================
// 컴포넌트 타입 정의
// =============================================================================

export type HeaderStyle = 'simple' | 'mega-menu' | 'minimal' | 'centered';
export type FooterStyle = 'simple' | 'three-column' | 'minimal' | 'newsletter';
export type ProductCardStyle = 'basic' | 'hover' | 'magazine' | 'minimal';
export type ProductGridStyle = 'grid-2' | 'grid-3' | 'grid-4' | 'grid-5' | 'slider' | 'masonry';
export type BannerStyle = 'fullwidth' | 'slider' | 'grid' | 'video';
export type SectionStyle = 'grid' | 'carousel' | 'tabs' | 'list';

export interface ThemeLayoutConfig {
  header: HeaderStyle;
  footer: FooterStyle;
  productCard: ProductCardStyle;
  productGrid: ProductGridStyle;

  // 메인페이지 섹션 배치
  homeSections: HomeSectionConfig[];

  // 상세 설정
  settings: {
    headerFixed: boolean;
    showBreadcrumb: boolean;
    sidebarPosition: 'left' | 'right' | 'none';
    productImageRatio: '1:1' | '4:3' | '3:4';
  };
}

export interface HomeSectionConfig {
  id: string;
  type: 'banner' | 'products' | 'categories' | 'reviews' | 'brands' | 'custom';
  style: string;
  title?: string;
  settings?: Record<string, any>;
}

// =============================================================================
// 기본 테마 Config
// =============================================================================

export const DEFAULT_THEME_CONFIG: ThemeLayoutConfig = {
  header: 'simple',
  footer: 'three-column',
  productCard: 'hover',
  productGrid: 'grid-4',
  homeSections: [
    { id: 'main-banner', type: 'banner', style: 'slider' },
    { id: 'new-products', type: 'products', style: 'grid', title: '신상품' },
    { id: 'best-products', type: 'products', style: 'carousel', title: '베스트' },
    { id: 'reviews', type: 'reviews', style: 'carousel', title: '고객 후기' },
  ],
  settings: {
    headerFixed: true,
    showBreadcrumb: true,
    sidebarPosition: 'none',
    productImageRatio: '1:1',
  },
};

// =============================================================================
// 컴포넌트 레지스트리
// =============================================================================

type LazyComponent = ComponentType<any>;

interface ComponentRegistry {
  headers: Record<HeaderStyle, LazyComponent>;
  footers: Record<FooterStyle, LazyComponent>;
  productCards: Record<ProductCardStyle, LazyComponent>;
  productGrids: Record<ProductGridStyle, LazyComponent>;
  banners: Record<BannerStyle, LazyComponent>;
  sections: Record<SectionStyle, LazyComponent>;
}

// Lazy load 컴포넌트들
export const COMPONENT_REGISTRY: ComponentRegistry = {
  headers: {
    'simple': lazy(() => import('@/components/themes/headers/SimpleHeader')),
    'mega-menu': lazy(() => import('@/components/themes/headers/MegaMenuHeader')),
    'minimal': lazy(() => import('@/components/themes/headers/MinimalHeader')),
    'centered': lazy(() => import('@/components/themes/headers/CenteredHeader')),
  },
  footers: {
    'simple': lazy(() => import('@/components/themes/footers/SimpleFooter')),
    'three-column': lazy(() => import('@/components/themes/footers/ThreeColumnFooter')),
    'minimal': lazy(() => import('@/components/themes/footers/MinimalFooter')),
    'newsletter': lazy(() => import('@/components/themes/footers/NewsletterFooter')),
  },
  productCards: {
    'basic': lazy(() => import('@/components/themes/products/BasicProductCard')),
    'hover': lazy(() => import('@/components/themes/products/HoverProductCard')),
    'magazine': lazy(() => import('@/components/themes/products/MagazineProductCard')),
    'minimal': lazy(() => import('@/components/themes/products/MinimalProductCard')),
  },
  productGrids: {
    'grid-2': lazy(() => import('@/components/themes/grids/Grid2')),
    'grid-3': lazy(() => import('@/components/themes/grids/Grid3')),
    'grid-4': lazy(() => import('@/components/themes/grids/Grid4')),
    'grid-5': lazy(() => import('@/components/themes/grids/Grid5')),
    'slider': lazy(() => import('@/components/themes/grids/SliderGrid')),
    'masonry': lazy(() => import('@/components/themes/grids/MasonryGrid')),
  },
  banners: {
    'fullwidth': lazy(() => import('@/components/themes/banners/FullwidthBanner')),
    'slider': lazy(() => import('@/components/themes/banners/SliderBanner')),
    'grid': lazy(() => import('@/components/themes/banners/GridBanner')),
    'video': lazy(() => import('@/components/themes/banners/VideoBanner')),
  },
  sections: {
    'grid': lazy(() => import('@/components/themes/sections/GridSection')),
    'carousel': lazy(() => import('@/components/themes/sections/CarouselSection')),
    'tabs': lazy(() => import('@/components/themes/sections/TabsSection')),
    'list': lazy(() => import('@/components/themes/sections/ListSection')),
  },
};

// =============================================================================
// 컴포넌트 메타데이터 (관리자 UI용)
// =============================================================================

export interface ComponentMeta {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
}

export const COMPONENT_META = {
  headers: [
    { id: 'simple', name: '심플', description: '로고 + 메뉴 + 검색 기본 구성' },
    { id: 'mega-menu', name: '메가메뉴', description: '드롭다운 메가메뉴 헤더' },
    { id: 'minimal', name: '미니멀', description: '로고 + 햄버거 메뉴만' },
    { id: 'centered', name: '중앙정렬', description: '로고 중앙, 메뉴 아래 배치' },
  ],
  footers: [
    { id: 'simple', name: '심플', description: '기본 푸터' },
    { id: 'three-column', name: '3컬럼', description: '회사정보 + 링크 + 고객센터' },
    { id: 'minimal', name: '미니멀', description: '카피라이트만' },
    { id: 'newsletter', name: '뉴스레터', description: '이메일 구독 폼 포함' },
  ],
  productCards: [
    { id: 'basic', name: '기본', description: '이미지 + 상품명 + 가격' },
    { id: 'hover', name: '호버효과', description: '마우스오버 시 퀵뷰/장바구니' },
    { id: 'magazine', name: '매거진', description: '큰 이미지 + 상세 정보' },
    { id: 'minimal', name: '미니멀', description: '이미지 + 가격만' },
  ],
  productGrids: [
    { id: 'grid-2', name: '2컬럼', description: '한 줄에 2개' },
    { id: 'grid-3', name: '3컬럼', description: '한 줄에 3개' },
    { id: 'grid-4', name: '4컬럼', description: '한 줄에 4개 (기본)' },
    { id: 'grid-5', name: '5컬럼', description: '한 줄에 5개' },
    { id: 'slider', name: '슬라이더', description: '가로 스크롤 슬라이더' },
    { id: 'masonry', name: '핀터레스트', description: '높이가 다른 그리드' },
  ],
  banners: [
    { id: 'fullwidth', name: '풀화면', description: '단일 이미지 풀화면' },
    { id: 'slider', name: '슬라이더', description: '여러 이미지 슬라이드' },
    { id: 'grid', name: '그리드', description: '여러 배너 그리드 배치' },
    { id: 'video', name: '비디오', description: '영상 배너' },
  ],
  sections: [
    { id: 'grid', name: '그리드', description: '기본 그리드 레이아웃' },
    { id: 'carousel', name: '캐러셀', description: '좌우 스크롤 캐러셀' },
    { id: 'tabs', name: '탭', description: '탭으로 카테고리 전환' },
    { id: 'list', name: '리스트', description: '세로 리스트 형태' },
  ],
};

// =============================================================================
// 유틸리티 함수
// =============================================================================

export function getHeaderComponent(style: HeaderStyle) {
  return COMPONENT_REGISTRY.headers[style] || COMPONENT_REGISTRY.headers['simple'];
}

export function getFooterComponent(style: FooterStyle) {
  return COMPONENT_REGISTRY.footers[style] || COMPONENT_REGISTRY.footers['simple'];
}

export function getProductCardComponent(style: ProductCardStyle) {
  return COMPONENT_REGISTRY.productCards[style] || COMPONENT_REGISTRY.productCards['basic'];
}

export function getProductGridComponent(style: ProductGridStyle) {
  return COMPONENT_REGISTRY.productGrids[style] || COMPONENT_REGISTRY.productGrids['grid-4'];
}

export function getBannerComponent(style: BannerStyle) {
  return COMPONENT_REGISTRY.banners[style] || COMPONENT_REGISTRY.banners['slider'];
}

export function getSectionComponent(style: SectionStyle) {
  return COMPONENT_REGISTRY.sections[style] || COMPONENT_REGISTRY.sections['grid'];
}
