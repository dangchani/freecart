import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageSection } from '@/components/theme/PageSection';
import { ProductCard } from '@/components/product-card';
import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/types';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LIMIT = 20;

const SORT_OPTIONS = [
  { value: 'newest', label: '최신순' },
  { value: 'price_asc', label: '낮은가격순' },
  { value: 'price_desc', label: '높은가격순' },
  { value: 'popular', label: '인기순' },
  { value: 'review', label: '리뷰많은순' },
];

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
}

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();

  const [category, setCategory] = useState<Category | null>(null);
  // 화면 표시용 (is_visible=true 인 하위 카테고리만)
  const [visibleSubs, setVisibleSubs] = useState<Category[]>([]);
  // 상품 조회 범위용 (is_visible 무관한 하위 카테고리 ID 목록)
  const [allSubIds, setAllSubIds] = useState<string[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [notFound, setNotFound] = useState(false);

  // slug 변경 시 처음부터 전체 로드
  useEffect(() => {
    if (slug) loadCategoryAndProducts(slug, 1, 'newest');
    setSort('newest');
    setPage(1);
  }, [slug]);

  /**
   * 카테고리 + 하위 카테고리 + 상품을 순서대로 한 번에 로드.
   * state 타이밍에 의존하지 않고 직접 fetch된 값을 사용.
   */
  async function loadCategoryAndProducts(catSlug: string, pg: number, srt: string) {
    setLoading(true);
    try {
      const supabase = createClient();

      // 1. 현재 카테고리 조회
      const { data: cat } = await supabase
        .from('product_categories')
        .select('id, name, slug, description, image_url')
        .eq('slug', catSlug)
        .eq('is_visible', true)
        .single();

      if (!cat) {
        setNotFound(true);
        setCategory(null);
        return;
      }
      setNotFound(false);
      setCategory(cat);

      // 2. 상품 포함 범위용: is_visible 조건 없이 모든 하위 카테고리 ID 수집
      const { data: allSubs } = await supabase
        .from('product_categories')
        .select('id')
        .eq('parent_id', cat.id);
      const subIds = (allSubs || []).map((s: any) => s.id);
      setAllSubIds(subIds);

      // 3. 화면 표시용: is_visible=true 인 하위 카테고리만 (링크 chips)
      const { data: visSubs } = await supabase
        .from('product_categories')
        .select('id, name, slug, description, image_url')
        .eq('parent_id', cat.id)
        .eq('is_visible', true)
        .order('sort_order');
      setVisibleSubs(visSubs || []);

      // 4. 바로 위에서 받은 값으로 상품 조회 (state 타이밍 무관)
      await fetchProducts(cat.id, subIds, pg, srt);
    } finally {
      setLoading(false);
    }
  }

  /**
   * 상품만 다시 조회. 카테고리 정보는 파라미터로 직접 받음.
   */
  async function fetchProducts(catId: string, subIds: string[], pg: number, srt: string) {
    setLoading(true);
    try {
      const supabase = createClient();
      const from = (pg - 1) * LIMIT;
      const to = from + LIMIT - 1;
      const allIds = [catId, ...subIds];

      let query = supabase
        .from('products')
        .select('*, product_images(*)', { count: 'exact' })
        .eq('status', 'active')
        .in('category_id', allIds)
        .range(from, to);

      switch (srt) {
        case 'price_asc':  query = query.order('sale_price', { ascending: true });   break;
        case 'price_desc': query = query.order('sale_price', { ascending: false });  break;
        case 'popular':    query = query.order('sales_count', { ascending: false }); break;
        case 'review':     query = query.order('review_count', { ascending: false }); break;
        default:           query = query.order('created_at', { ascending: false });  break;
      }

      const { data, count } = await query;
      setProducts(
        (data || []).map((p: any) => ({
          id: p.id, name: p.name, slug: p.slug,
          categoryId: p.category_id, brandId: p.brand_id,
          regularPrice: p.regular_price, salePrice: p.sale_price,
          isSale: p.is_sale ?? false, hasOptions: p.has_options ?? false,
          images: (p.product_images || []).map((img: any) => ({
            id: img.id, url: img.url, isPrimary: img.is_primary, sortOrder: img.sort_order,
          })),
          reviewAvg: p.review_avg ? parseFloat(p.review_avg) : 0,
          reviewCount: p.review_count || 0,
          salesCount: p.sales_count || 0,
          isNew: p.is_new ?? false, isBest: p.is_best ?? false, isFeatured: p.is_featured ?? false,
          stockQuantity: p.stock_quantity, status: p.status,
          createdAt: p.created_at, updatedAt: p.updated_at,
        }))
      );
      setTotal(count || 0);
    } finally {
      setLoading(false);
    }
  }

  function handleSortChange(newSort: string) {
    setSort(newSort);
    setPage(1);
    if (category) fetchProducts(category.id, allSubIds, 1, newSort);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    if (category) fetchProducts(category.id, allSubIds, newPage, sort);
  }

  if (notFound) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">카테고리를 찾을 수 없습니다</h1>
        <p className="text-gray-500 mb-6">요청하신 카테고리가 존재하지 않거나 비공개 상태입니다.</p>
        <Link to="/products">
          <Button>전체 상품 보기</Button>
        </Link>
      </div>
    );
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      <PageSection id="category" />
      <div className="container mx-auto px-4 py-8">

        {/* 브레드크럼 */}
        <nav className="mb-4 flex items-center gap-1 text-sm text-gray-500">
          <Link to="/" className="hover:text-gray-700">홈</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/products" className="hover:text-gray-700">전체 상품</Link>
          {category && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="text-gray-800 font-medium">{category.name}</span>
            </>
          )}
        </nav>

        {/* 카테고리 헤더 */}
        {category && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">{category.name}</h1>
            {category.description && (
              <p className="mt-1 text-sm text-gray-500">{category.description}</p>
            )}
          </div>
        )}

        {/* 하위 카테고리 chips (is_visible=true 인 것만) */}
        {visibleSubs.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {visibleSubs.map((sub) => (
              <Link
                key={sub.id}
                to={`/categories/${sub.slug}`}
                className="rounded-full border px-4 py-1.5 text-sm hover:border-blue-500 hover:text-blue-600 transition-colors"
              >
                {sub.name}
              </Link>
            ))}
          </div>
        )}

        {/* 정렬 + 상품 수 */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            총 <span className="font-medium text-gray-800">{total}</span>개 상품
          </p>
          <select
            value={sort}
            onChange={(e) => handleSortChange(e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* 상품 목록 */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-500">이 카테고리에 등록된 상품이 없습니다.</p>
            <Link to="/products" className="mt-4 inline-block">
              <Button variant="outline">전체 상품 보기</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              return (
                <Button
                  key={p}
                  variant={page === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePageChange(p)}
                >
                  {p}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
