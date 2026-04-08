import { useState, useEffect, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Tag, Truck, RefreshCw, Shield, Headphones } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useHomeSections, useThemeConfig } from '@/lib/theme/theme-context';
import type { HomeSectionConfig } from '@/lib/theme/types';
import { dispatchThemeEvent } from '@/lib/theme/theme-loader';
import { ThemeSection } from '@/components/theme/ThemeSection';

// =============================================================================
// 공통 타입
// =============================================================================

interface Product {
  id: string;
  name: string;
  slug: string;
  regularPrice: number;
  salePrice: number;
  images?: { id: string; url: string; isPrimary: boolean }[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

// =============================================================================
// 상품 카드
// =============================================================================

function ProductCard({ product }: { product: Product }) {
  const hasDiscount = product.regularPrice > product.salePrice;
  const discountPercent = hasDiscount
    ? Math.round(((product.regularPrice - product.salePrice) / product.regularPrice) * 100)
    : 0;
  const primaryImage = product.images?.find((img) => img.isPrimary) || product.images?.[0];
  const imageUrl = primaryImage?.url || '/placeholder.png';

  return (
    <Link to={`/products/${product.slug}`} className="group block">
      <div className="relative overflow-hidden rounded-xl bg-gray-100 aspect-square mb-3">
        <img
          src={imageUrl}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {hasDiscount && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md">
            {discountPercent}% OFF
          </span>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-800 group-hover:text-blue-600 line-clamp-2 mb-1">
        {product.name}
      </h3>
      <div className="flex items-center gap-2">
        <span className="font-bold text-gray-900">{product.salePrice.toLocaleString()}원</span>
        {hasDiscount && (
          <span className="text-xs text-gray-400 line-through">
            {product.regularPrice.toLocaleString()}원
          </span>
        )}
      </div>
    </Link>
  );
}

function ProductSkeleton() {
  return (
    <div className="block">
      <div className="aspect-square rounded-xl bg-gray-200 animate-pulse mb-3" />
      <div className="h-4 bg-gray-200 animate-pulse rounded mb-1" />
      <div className="h-4 w-1/2 bg-gray-200 animate-pulse rounded" />
    </div>
  );
}

// =============================================================================
// 섹션 컴포넌트들
// =============================================================================

/** 상품 섹션 */
function ProductsSection({ section }: { section: HomeSectionConfig }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const settings = section.settings || {};
  const filter = settings.filter as string | undefined;
  const limit = (settings.limit as number) || 8;
  const badge = (settings.badge as string) || undefined;

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        let q = supabase
          .from('products')
          .select('id, name, slug, regular_price, sale_price, product_images(id, url, is_primary)')
          .eq('status', 'active')
          .limit(limit);

        if (filter === 'isFeatured') q = q.eq('is_featured', true);
        else if (filter === 'isNew') q = q.eq('is_new', true);
        else if (filter === 'isBest') q = q.eq('is_best', true);
        else if (filter === 'onSale') q = q.lt('sale_price', q as any);

        const { data } = await q.order('created_at', { ascending: false });
        setProducts(
          (data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            regularPrice: p.regular_price,
            salePrice: p.sale_price,
            images: (p.product_images || []).map((img: any) => ({
              id: img.id,
              url: img.url,
              isPrimary: img.is_primary,
            })),
          }))
        );
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [filter, limit]);

  const filterQuery = filter ? `${filter}=true` : '';

  return (
    <section className="py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {badge && (
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
              {badge}
            </span>
          )}
          <h2 className="text-2xl font-bold text-gray-900">{section.title || '상품'}</h2>
        </div>
        <Link
          to={`/products?${filterQuery}`}
          className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          전체보기 <ChevronRight className="h-4 w-4 ml-0.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)
          : products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

/** 배너/히어로 섹션 */
function BannerSection({ section }: { section: HomeSectionConfig }) {
  const settings = section.settings || {};

  // 커스텀 이미지 배너
  if (settings.imageUrl) {
    return (
      <section className="relative overflow-hidden">
        <a href={(settings.linkUrl as string) || '#'}>
          <img
            src={settings.imageUrl as string}
            alt={section.title || '배너'}
            className="w-full object-cover max-h-[500px]"
          />
        </a>
      </section>
    );
  }

  // 기본 히어로 배너
  return (
    <section className="relative bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
      </div>
      <div className="container mx-auto px-4 py-20 md:py-32 relative z-10">
        <div className="max-w-2xl">
          <span className="inline-block bg-white/20 text-white text-sm font-medium px-4 py-1.5 rounded-full mb-6 backdrop-blur-sm">
            🎉 신규 회원 가입 시 10% 할인 쿠폰 증정
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
            대신 더 나은 쇼핑 경험!
            <br />
            <span className="text-yellow-300">Freecart</span>
          </h1>
          <p className="text-lg md:text-xl text-blue-100 mb-8 leading-relaxed">
            최고의 상품을 최저가로 만나보세요.
            <br />
            매일 새로운 특가 상품이 업데이트됩니다.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/products"
              className="inline-flex items-center bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-8 py-4 rounded-xl text-lg transition-colors shadow-lg"
            >
              쇼핑 시작하기
              <ChevronRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
              to="/products?isFeatured=true"
              className="inline-flex items-center bg-white/20 hover:bg-white/30 text-white font-bold px-8 py-4 rounded-xl text-lg transition-colors backdrop-blur-sm border border-white/30"
            >
              추천 상품 보기
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** 카테고리 섹션 */
function CategoriesSection({ section }: { section: HomeSectionConfig }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const categoryIcons = ['🛍️', '👕', '👟', '🏠', '💻', '📱', '🍎', '🎮', '💄', '📚'];

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase
          .from('product_categories')
          .select('id, name, slug, image_url')
          .eq('is_visible', true)
          .order('sort_order', { ascending: true })
          .limit(8);
        setCategories((data || []).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug, icon: c.image_url })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section className="py-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{section.title || '카테고리'}</h2>
        <Link to="/categories" className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium">
          전체보기 <ChevronRight className="h-4 w-4 ml-0.5" />
        </Link>
      </div>
      {loading ? (
        <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-gray-200 animate-pulse" />
              <div className="h-3 w-12 bg-gray-200 animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
          {categories.map((cat, idx) => (
            <Link
              key={cat.id}
              to={`/categories/${cat.slug}`}
              className="group flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-blue-50 transition-colors"
            >
              <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-2xl group-hover:from-blue-200 group-hover:to-indigo-200 transition-colors">
                {cat.icon || categoryIcons[idx % categoryIcons.length]}
              </div>
              <span className="text-xs font-medium text-gray-700 text-center leading-tight">{cat.name}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/** 브랜드 섹션 */
function BrandsSection({ section }: { section: HomeSectionConfig }) {
  return (
    <section className="py-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{section.title || '브랜드'}</h2>
        <Link to="/brands" className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium">
          전체보기 <ChevronRight className="h-4 w-4 ml-0.5" />
        </Link>
      </div>
      <div className="text-center text-gray-400 py-8">브랜드 섹션</div>
    </section>
  );
}

/** 혜택 배너 (고정) */
function BenefitSection() {
  return (
    <section className="bg-gray-50 border-b">
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          {[
            { icon: <Truck className="h-6 w-6" />, title: '무료 배송', desc: '5만원 이상 구매 시' },
            { icon: <RefreshCw className="h-6 w-6" />, title: '간편 반품', desc: '30일 이내 무료 반품' },
            { icon: <Shield className="h-6 w-6" />, title: '안전 결제', desc: '구매 안전 보장' },
            { icon: <Headphones className="h-6 w-6" />, title: '고객 지원', desc: '24/7 상담 서비스' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3">
              <div className="flex-shrink-0 text-blue-600 bg-blue-100 p-2 rounded-lg">{item.icon}</div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** 프로모션 배너 (고정) */
function PromoBannerSection() {
  return (
    <section className="py-10">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="relative bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl p-8 text-white overflow-hidden">
          <div className="absolute -right-6 -bottom-6 text-8xl opacity-30">🔥</div>
          <div className="relative z-10">
            <Tag className="h-8 w-8 mb-3" />
            <h3 className="text-xl font-bold mb-2">오늘의 특가</h3>
            <p className="text-orange-100 text-sm mb-4">매일 바뀌는 특가 상품을 놓치지 마세요</p>
            <Link
              to="/products?sort=discount"
              className="inline-flex items-center bg-white text-orange-600 font-bold text-sm px-4 py-2 rounded-lg hover:bg-orange-50 transition-colors"
            >
              특가 보러가기 <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="relative bg-gradient-to-br from-green-400 to-teal-500 rounded-2xl p-8 text-white overflow-hidden">
          <div className="absolute -right-6 -bottom-6 text-8xl opacity-30">🎁</div>
          <div className="relative z-10">
            <Shield className="h-8 w-8 mb-3" />
            <h3 className="text-xl font-bold mb-2">신규 가입 혜택</h3>
            <p className="text-green-100 text-sm mb-4">지금 가입하면 첫 구매 10% 할인 쿠폰 증정</p>
            <Link
              to="/auth/signup"
              className="inline-flex items-center bg-white text-green-600 font-bold text-sm px-4 py-2 rounded-lg hover:bg-green-50 transition-colors"
            >
              회원가입 <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// 섹션 타입 → 컴포넌트 매핑
// =============================================================================

function renderSection(section: HomeSectionConfig) {
  switch (section.type) {
    case 'banner':
      return <BannerSection key={section.id} section={section} />;
    case 'products':
      return <ProductsSection key={section.id} section={section} />;
    case 'categories':
      return <CategoriesSection key={section.id} section={section} />;
    case 'brands':
      return <BrandsSection key={section.id} section={section} />;
    case 'reviews':
      return null; // TODO: 리뷰 섹션 구현
    case 'custom':
      return section.settings?.html ? (
        <section key={section.id} className="py-10" dangerouslySetInnerHTML={{ __html: section.settings.html as string }} />
      ) : null;
    default:
      return null;
  }
}

// =============================================================================
// HTML 테마 홈 렌더러 — layout_config.homeSections 기반
// =============================================================================

// 데이터 섹션: DB에서 실제 데이터를 가져와야 하는 섹션 ID들
const DATA_SECTION_SETTINGS: Record<string, { filter?: string; badge?: string; title?: string }> = {
  'new-products':  { filter: 'isNew',      badge: 'NEW',  title: '신상품' },
  'best-products': { filter: 'isBest',     badge: 'BEST', title: '베스트셀러' },
  'products':      { filter: 'isFeatured', badge: 'PICK', title: '추천 상품' },
  'featured':      { filter: 'isFeatured', badge: 'PICK', title: '추천 상품' },
};

function HtmlThemeHomeRenderer({
  htmlUrls,
  themeSettings,
}: {
  htmlUrls: Record<string, string>;
  themeSettings: Record<string, string>;
}) {
  const { layoutConfig } = useThemeConfig();
  const homeSections = layoutConfig.homeSections ?? [];

  return (
    <>
      {homeSections
        .filter((s) => s.enabled !== false)
        .map((s) => {
          // 데이터 섹션 → React 컴포넌트 (실제 DB 데이터)
          const dataCfg = DATA_SECTION_SETTINGS[s.id];
          if (dataCfg) {
            return (
              <div key={s.id} className="bg-white">
                <ProductsSection
                  section={{
                    id: s.id,
                    type: 'products',
                    style: 'grid',
                    title: s.title || dataCfg.title,
                    settings: { filter: dataCfg.filter, badge: dataCfg.badge },
                  }}
                />
              </div>
            );
          }
          // reviews 섹션 → React 컴포넌트
          if (s.id === 'reviews') {
            return null; // TODO: ReviewsSection with DB data
          }
          // 정적 HTML 섹션 → ThemeSection
          const url = htmlUrls[s.id];
          if (!url) return null;
          return <ThemeSection key={s.id} htmlUrl={url} settings={themeSettings} />;
        })}
    </>
  );
}

// =============================================================================
// 공지 스트립 (항상 상단에 표시)
// =============================================================================

function NoticeStrip() {
  const [notices, setNotices] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase
          .from('notices')
          .select('id, title')
          .order('created_at', { ascending: false })
          .limit(3);
        setNotices((data || []).map((n: any) => ({ id: n.id, title: n.title })));
      } catch {
        // ignore
      }
    })();
  }, []);

  if (notices.length === 0) return null;

  return (
    <div className="bg-blue-600 text-white py-2">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide">
          <span className="text-xs font-bold bg-white text-blue-600 px-2 py-0.5 rounded shrink-0">공지</span>
          <div className="flex items-center gap-6 text-sm">
            {notices.map((n) => (
              <Link key={n.id} to={`/notices/${n.id}`} className="hover:underline whitespace-nowrap">
                {n.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 홈페이지
// =============================================================================

export default function HomePage() {
  const sections = useHomeSections();
  const { activeTheme } = useThemeConfig();

  const htmlUrls = activeTheme?.sectionHtmlUrls ?? {};
  const themeSettings = activeTheme?.themeSettings ?? {};

  // HTML 템플릿 테마 여부 — sectionHtmlUrls에 본문 섹션이 하나라도 있으면
  const hasHtmlTheme = Object.keys(htmlUrls).some((k) => k !== 'header' && k !== 'footer');

  useEffect(() => {
    dispatchThemeEvent('page-load');
  }, []);

  const useSections = sections.length > 0;

  return (
    <div className="min-h-screen bg-white">
      {/* 공지 스트립 (항상 표시) */}
      <NoticeStrip />

      {hasHtmlTheme ? (
        /* ── HTML 테마 렌더링 (homeSections 순서 기준, 데이터 섹션은 React) ── */
        <HtmlThemeHomeRenderer htmlUrls={htmlUrls} themeSettings={themeSettings} />
      ) : useSections ? (
        /* ── React 컴포넌트 기반 섹션 렌더링 ── */
        <>
          {sections.map((section) => (
            <div key={section.id}>
              {renderSection(section)}
              {section.type === 'banner' && <BenefitSection />}
            </div>
          ))}
          <div className="container mx-auto px-4">
            <PromoBannerSection />
          </div>
        </>
      ) : (
        /* ── 기본 레이아웃 (테마 미설정 시) ── */
        <>
          <BannerSection section={{ id: 'hero', type: 'banner', style: 'hero' }} />
          <BenefitSection />
          <div className="container mx-auto px-4">
            <CategoriesSection section={{ id: 'categories', type: 'categories', style: 'grid', title: '카테고리' }} />
            <hr className="border-gray-100" />
            <ProductsSection section={{ id: 'featured', type: 'products', style: 'grid', title: '추천 상품', settings: { filter: 'isFeatured', badge: 'PICK' } }} />
            <hr className="border-gray-100" />
            <ProductsSection section={{ id: 'new', type: 'products', style: 'grid', title: '신상품', settings: { filter: 'isNew', badge: 'NEW' } }} />
            <hr className="border-gray-100" />
            <ProductsSection section={{ id: 'best', type: 'products', style: 'grid', title: '베스트 상품', settings: { filter: 'isBest', badge: 'BEST' } }} />
            <PromoBannerSection />
          </div>
        </>
      )}
    </div>
  );
}
