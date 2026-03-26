import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '@/components/product-card';
import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/types';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Category {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

const SORT_OPTIONS = [
  { value: 'newest', label: '최신순' },
  { value: 'price_asc', label: '낮은가격순' },
  { value: 'price_desc', label: '높은가격순' },
  { value: 'popular', label: '인기순' },
  { value: 'review', label: '리뷰많은순' },
];

const LIMIT = 20;

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const q = searchParams.get('q') || '';
  const categoryId = searchParams.get('categoryId') || '';
  const brandId = searchParams.get('brandId') || '';
  const sort = searchParams.get('sort') || 'newest';
  const isFeatured = searchParams.get('isFeatured') === 'true';
  const isNew = searchParams.get('isNew') === 'true';
  const isBest = searchParams.get('isBest') === 'true';
  const page = parseInt(searchParams.get('page') || '1');

  const totalPages = Math.ceil(total / LIMIT);

  useEffect(() => {
    async function loadMeta() {
      const supabase = createClient();
      const [catRes, brandRes] = await Promise.all([
        supabase.from('product_categories').select('id, name').eq('is_visible', true).order('sort_order'),
        supabase.from('product_brands').select('id, name').order('name'),
      ]);
      setCategories((catRes.data || []).map((c: any) => ({ id: c.id, name: c.name })));
      setBrands((brandRes.data || []).map((b: any) => ({ id: b.id, name: b.name })));
    }
    loadMeta();
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const from = (page - 1) * LIMIT;
      const to = from + LIMIT - 1;

      let query = supabase
        .from('products')
        .select('*, product_images(*)', { count: 'exact' })
        .eq('status', 'active')
        .range(from, to);

      if (q) query = query.ilike('name', `%${q}%`);
      if (categoryId) query = query.eq('category_id', categoryId);
      if (brandId) query = query.eq('brand_id', brandId);
      if (isFeatured) query = query.eq('is_featured', true);
      if (isNew) query = query.eq('is_new', true);
      if (isBest) query = query.eq('is_best', true);

      switch (sort) {
        case 'price_asc': query = query.order('sale_price', { ascending: true }); break;
        case 'price_desc': query = query.order('sale_price', { ascending: false }); break;
        case 'popular': query = query.order('sales_count', { ascending: false }); break;
        case 'review': query = query.order('review_count', { ascending: false }); break;
        default: query = query.order('created_at', { ascending: false }); break;
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setTotal(count || 0);
      setProducts(
        (data || []).map((p: any) => ({
          id: p.id, categoryId: p.category_id, brandId: p.brand_id,
          name: p.name, slug: p.slug, summary: p.summary, description: p.description,
          regularPrice: p.regular_price, salePrice: p.sale_price,
          stockQuantity: p.stock_quantity, status: p.status,
          isFeatured: p.is_featured, isNew: p.is_new, isBest: p.is_best, isSale: p.is_sale,
          viewCount: p.view_count, salesCount: p.sales_count,
          reviewCount: p.review_count, reviewAvg: p.review_avg ? parseFloat(p.review_avg) : 0,
          hasOptions: p.has_options,
          images: (p.product_images || []).map((img: any) => ({
            id: img.id, url: img.url, isPrimary: img.is_primary,
          })),
          createdAt: p.created_at, updatedAt: p.updated_at,
        }))
      );
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  }, [q, categoryId, brandId, sort, isFeatured, isNew, isBest, page]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value;
    updateParam('q', input);
  }

  function goPage(p: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
  }

  // 현재 적용된 필터 레이블
  const pageTitle = isFeatured ? '추천 상품' : isNew ? '신상품' : isBest ? '베스트 상품' : '전체 상품';

  return (
    <div className="container py-8">
      {/* 상단 헤더 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {pageTitle}
          {!loading && <span className="ml-2 text-base font-normal text-gray-400">{total.toLocaleString()}개</span>}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal className="mr-1.5 h-4 w-4" />
            필터
          </Button>
          <select
            value={sort}
            onChange={(e) => updateParam('sort', e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 검색바 */}
      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="상품명 검색..."
            className="w-full rounded-md border py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <Button type="submit">검색</Button>
      </form>

      {/* 필터 패널 */}
      {showFilters && (
        <div className="mb-6 rounded-xl border bg-gray-50 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">카테고리</label>
              <select
                value={categoryId}
                onChange={(e) => updateParam('categoryId', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체 카테고리</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">브랜드</label>
              <select
                value={brandId}
                onChange={(e) => updateParam('brandId', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">전체 브랜드</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { key: 'isFeatured', label: '추천상품', active: isFeatured },
              { key: 'isNew', label: '신상품', active: isNew },
              { key: 'isBest', label: '베스트', active: isBest },
            ].map(({ key, label, active }) => (
              <button
                key={key}
                onClick={() => updateParam(key, active ? '' : 'true')}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  active ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setSearchParams({})}
              className="rounded-full px-3 py-1 text-sm text-red-500 hover:bg-red-50 border border-red-200"
            >
              필터 초기화
            </button>
          </div>
        </div>
      )}

      {/* 상품 그리드 */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-square rounded-xl bg-gray-200 animate-pulse mb-3" />
              <div className="h-4 bg-gray-200 animate-pulse rounded mb-1" />
              <div className="h-4 w-1/2 bg-gray-200 animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 text-center text-gray-500">
          <p className="mb-2 text-lg">검색 결과가 없습니다.</p>
          <button onClick={() => setSearchParams({})} className="text-sm text-blue-600 hover:underline">
            필터 초기화
          </button>
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
        <div className="mt-10 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goPage(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let p = i + 1;
            if (totalPages > 7) {
              if (page <= 4) p = i + 1;
              else if (page >= totalPages - 3) p = totalPages - 6 + i;
              else p = page - 3 + i;
            }
            return (
              <button
                key={p}
                onClick={() => goPage(p)}
                className={`h-8 w-8 rounded-md text-sm font-medium transition-colors ${
                  p === page ? 'bg-blue-600 text-white' : 'border hover:bg-gray-100'
                }`}
              >
                {p}
              </button>
            );
          })}

          <Button
            variant="outline"
            size="sm"
            onClick={() => goPage(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
