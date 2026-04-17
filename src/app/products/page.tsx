import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageSection } from '@/components/theme/PageSection';
import { ProductCard } from '@/components/product-card';
import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/types';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  children?: Category[];
}

interface Brand {
  id: string;
  name: string;
}

interface Tag {
  id: string;
  name: string;
}

interface Attribute {
  id: string;
  name: string;
  values: { id: string; value: string }[];
}

const SORT_OPTIONS = [
  { value: 'newest', label: '최신순' },
  { value: 'price_asc', label: '낮은가격순' },
  { value: 'price_desc', label: '높은가격순' },
  { value: 'popular', label: '인기순' },
  { value: 'review', label: '리뷰많은순' },
];

const LIMIT = 20;

/** 플랫 카테고리 배열 → 2단계 트리 */
function buildCategoryTree(flat: Category[]): Category[] {
  const roots: Category[] = [];
  const map: Record<string, Category> = {};
  flat.forEach((c) => { map[c.id] = { ...c, children: [] }; });
  flat.forEach((c) => {
    if (c.parentId && map[c.parentId]) {
      map[c.parentId].children!.push(map[c.id]);
    } else if (!c.parentId) {
      roots.push(map[c.id]);
    }
  });
  return roots;
}

export default function ProductsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryTree, setCategoryTree] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  // 사이드바에서 펼쳐진 루트 카테고리 ID
  const [expandedCatIds, setExpandedCatIds] = useState<Set<string>>(new Set());

  const q = searchParams.get('q') || '';
  const categoryId = searchParams.get('categoryId') || '';
  const brandId = searchParams.get('brandId') || '';
  const tagId = searchParams.get('tagId') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const attrValues = searchParams.get('attrs') || '';
  const sort = searchParams.get('sort') || 'newest';
  const isFeatured = searchParams.get('isFeatured') === 'true';
  const isNew = searchParams.get('isNew') === 'true';
  const isBest = searchParams.get('isBest') === 'true';
  const page = parseInt(searchParams.get('page') || '1');

  const totalPages = Math.ceil(total / LIMIT);

  useEffect(() => {
    async function loadMeta() {
      const supabase = createClient();
      const [catRes, brandRes, tagRes, attrRes] = await Promise.all([
        supabase.from('product_categories').select('id, name, parent_id').eq('is_visible', true).order('sort_order'),
        supabase.from('product_brands').select('id, name').order('name'),
        supabase.from('product_tags').select('id, name').order('name'),
        supabase.from('product_attributes').select('id, name, product_attribute_values(id, value)').order('sort_order'),
      ]);
      const cats = (catRes.data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        parentId: c.parent_id ?? null,
      }));
      setCategories(cats);
      setCategoryTree(buildCategoryTree(cats));
      setBrands((brandRes.data || []).map((b: any) => ({ id: b.id, name: b.name })));
      setTags((tagRes.data || []).map((t: any) => ({ id: t.id, name: t.name })));
      setAttributes((attrRes.data || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        values: (a.product_attribute_values || []).map((v: any) => ({ id: v.id, value: v.value })),
      })));
    }
    loadMeta();
  }, []);

  // 찜 목록 로드
  useEffect(() => {
    if (!user) { setWishlistIds(new Set()); return; }
    const supabase = createClient();
    supabase
      .from('user_wishlist')
      .select('product_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        setWishlistIds(new Set((data || []).map((w: any) => w.product_id)));
      });
  }, [user]);

  async function handleWishlistToggle(productId: string, currentlyWishlisted: boolean) {
    if (!user) return;
    const supabase = createClient();
    if (currentlyWishlisted) {
      await supabase.from('user_wishlist').delete().eq('user_id', user.id).eq('product_id', productId);
      setWishlistIds((prev) => { const next = new Set(prev); next.delete(productId); return next; });
    } else {
      await supabase.from('user_wishlist').insert({ user_id: user.id, product_id: productId });
      setWishlistIds((prev) => new Set([...prev, productId]));
    }
  }

  // 선택된 카테고리가 바뀌면 해당 루트 카테고리 자동 펼침
  useEffect(() => {
    if (!categoryId) return;
    const parent = categories.find((c) => c.id === categoryId && c.parentId === null);
    const child = categories.find((c) => c.id === categoryId && c.parentId !== null);
    if (parent) {
      setExpandedCatIds((prev) => new Set([...prev, parent.id]));
    } else if (child?.parentId) {
      setExpandedCatIds((prev) => new Set([...prev, child.parentId!]));
    }
  }, [categoryId, categories]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const from = (page - 1) * LIMIT;
      const to = from + LIMIT - 1;

      let query = supabase
        .from('products')
        .select('*, product_images(*), product_gift_sets(badge_text, badge_color, is_active, starts_at, ends_at)', { count: 'exact' })
        .eq('status', 'active')
        .range(from, to);

      if (q) query = query.ilike('name', `%${q}%`);
      if (categoryId) {
        const childIds = categories
          .filter((c) => c.parentId === categoryId)
          .map((c) => c.id);
        const allIds = [categoryId, ...childIds];
        query = allIds.length === 1
          ? query.eq('category_id', categoryId)
          : query.in('category_id', allIds);
      }
      if (brandId) query = query.eq('brand_id', brandId);
      if (tagId) {
        const { data: tagMap } = await supabase
          .from('product_tag_map')
          .select('product_id')
          .eq('tag_id', tagId);
        const tagProductIds = (tagMap || []).map((t: any) => t.product_id);
        if (tagProductIds.length === 0) {
          setProducts([]);
          setTotal(0);
          setLoading(false);
          return;
        }
        query = query.in('id', tagProductIds);
      }
      if (minPrice) query = query.gte('sale_price', parseInt(minPrice));
      if (maxPrice) query = query.lte('sale_price', parseInt(maxPrice));
      if (attrValues) {
        const attrValueIds = attrValues.split(',').filter(Boolean);
        if (attrValueIds.length > 0) {
          const { data: attrMap } = await supabase
            .from('product_attribute_value_map')
            .select('product_id')
            .in('attribute_value_id', attrValueIds);
          const attrProductIds = [...new Set((attrMap || []).map((r: any) => r.product_id))];
          if (attrProductIds.length === 0) {
            setProducts([]);
            setTotal(0);
            setLoading(false);
            return;
          }
          query = query.in('id', attrProductIds);
        }
      }
      if (isFeatured) query = query.eq('is_featured', true);
      if (isNew) query = query.eq('is_new', true);
      if (isBest) query = query.eq('is_best', true);

      switch (sort) {
        case 'price_asc':  query = query.order('sale_price', { ascending: true });   break;
        case 'price_desc': query = query.order('sale_price', { ascending: false });  break;
        case 'popular':    query = query.order('sales_count', { ascending: false }); break;
        case 'review':     query = query.order('review_count', { ascending: false }); break;
        default:           query = query.order('created_at', { ascending: false });  break;
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const now = new Date().toISOString();
      setTotal(count || 0);
      setProducts(
        (data || []).map((p: any) => {
          const activeBadgeSet = ((p.product_gift_sets as any[]) || []).find((gs: any) =>
            gs.is_active && gs.badge_text &&
            (!gs.starts_at || gs.starts_at <= now) &&
            (!gs.ends_at   || gs.ends_at   >= now)
          );
          return {
            id: p.id, categoryId: p.category_id, brandId: p.brand_id,
            name: p.name, slug: p.slug, summary: p.summary, description: p.description,
            regularPrice: p.regular_price, salePrice: p.sale_price,
            stockQuantity: p.stock_quantity, status: p.status,
            isFeatured: p.is_featured, isNew: p.is_new, isBest: p.is_best, isSale: p.is_sale,
            activeBadgeText:  activeBadgeSet?.badge_text  ?? null,
            activeBadgeColor: activeBadgeSet?.badge_color ?? null,
            viewCount: p.view_count, salesCount: p.sales_count,
            reviewCount: p.review_count, reviewAvg: p.review_avg ? parseFloat(p.review_avg) : 0,
            hasOptions: p.has_options,
            images: (p.product_images || []).map((img: any) => ({
              id: img.id, url: img.url, isPrimary: img.is_primary,
            })),
            createdAt: p.created_at, updatedAt: p.updated_at,
          };
        })
      );
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  }, [q, categoryId, brandId, tagId, minPrice, maxPrice, attrValues, sort, isFeatured, isNew, isBest, page, categories]);

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

  function toggleExpandCat(id: string) {
    setExpandedCatIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectCategory(id: string) {
    updateParam('categoryId', categoryId === id ? '' : id);
  }

  const pageTitle = isFeatured ? '추천 상품' : isNew ? '신상품' : isBest ? '베스트 상품' : '전체 상품';

  return (
    <>
      <PageSection id="product-list" />
      <div className="container py-8">

        {/* 상단 헤더 */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {pageTitle}
            {!loading && (
              <span className="ml-2 text-base font-normal text-gray-400">
                {total.toLocaleString()}개
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2">
            {/* 모바일: 필터 토글 버튼 */}
            <Button
              variant="outline"
              size="sm"
              className="md:hidden"
              onClick={() => setShowFilters(!showFilters)}
            >
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

        {/* 모바일 필터 패널 */}
        {showFilters && (
          <div className="mb-4 rounded-xl border bg-gray-50 p-4 md:hidden">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">카테고리</label>
                <select
                  value={categoryId}
                  onChange={(e) => updateParam('categoryId', e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">전체 카테고리</option>
                  {categoryTree.map((root) => (
                    <optgroup key={root.id} label={root.name}>
                      <option value={root.id}>{root.name} (전체)</option>
                      {(root.children || []).map((child) => (
                        <option key={child.id} value={child.id}>
                          &nbsp;&nbsp;{child.name}
                        </option>
                      ))}
                    </optgroup>
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
              {tags.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">태그</label>
                  <select
                    value={tagId}
                    onChange={(e) => updateParam('tagId', e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">전체 태그</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">가격 범위</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="최소"
                    value={minPrice}
                    onChange={(e) => updateParam('minPrice', e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-400">~</span>
                  <input
                    type="number"
                    placeholder="최대"
                    value={maxPrice}
                    onChange={(e) => updateParam('maxPrice', e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 속성 필터 */}
            {attributes.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <p className="mb-2 text-sm font-medium text-gray-700">속성 필터</p>
                <div className="flex flex-wrap gap-4">
                  {attributes.map((attr) => (
                    <div key={attr.id}>
                      <label className="mb-1 block text-xs text-gray-500">{attr.name}</label>
                      <select
                        value={attrValues.split(',').find((v) => attr.values.some((av) => av.id === v)) || ''}
                        onChange={(e) => {
                          const cur = attrValues ? attrValues.split(',').filter((v) => !attr.values.some((av) => av.id === v)) : [];
                          if (e.target.value) cur.push(e.target.value);
                          updateParam('attrs', cur.join(','));
                        }}
                        className="rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">전체</option>
                        {attr.values.map((v) => (
                          <option key={v.id} value={v.id}>{v.value}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

        {/* 데스크탑: 사이드바 + 상품 그리드 */}
        <div className="flex gap-6 items-start">

          {/* ── 카테고리 사이드바 (데스크탑) ── */}
          <aside className="hidden md:block w-52 shrink-0">
            <div className="sticky top-6 rounded-xl border bg-white p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">카테고리</p>

              {/* 전체 */}
              <button
                onClick={() => updateParam('categoryId', '')}
                className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  !categoryId
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                전체 상품
              </button>

              {categoryTree.map((root) => {
                const hasChildren = (root.children || []).length > 0;
                const isExpanded = expandedCatIds.has(root.id);
                const isRootSelected = categoryId === root.id;
                const isChildSelected = (root.children || []).some((c) => c.id === categoryId);

                return (
                  <div key={root.id} className="mb-0.5">
                    {/* 루트 카테고리 행 */}
                    <div className="flex items-center">
                      <button
                        onClick={() => selectCategory(root.id)}
                        className={`flex-1 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                          isRootSelected
                            ? 'bg-blue-600 text-white'
                            : isChildSelected
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {root.name}
                      </button>
                      {hasChildren && (
                        <button
                          onClick={() => toggleExpandCat(root.id)}
                          className="ml-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          aria-label={isExpanded ? '접기' : '펼치기'}
                        >
                          {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5" />
                            : <ChevronRightIcon className="h-3.5 w-3.5" />
                          }
                        </button>
                      )}
                    </div>

                    {/* 하위 카테고리 */}
                    {hasChildren && isExpanded && (
                      <div className="mt-0.5 ml-3 border-l pl-3">
                        {(root.children || []).map((child) => (
                          <button
                            key={child.id}
                            onClick={() => selectCategory(child.id)}
                            className={`mb-0.5 w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                              categoryId === child.id
                                ? 'bg-blue-600 text-white font-medium'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {child.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 데스크탑 추가 필터 */}
              <div className="mt-4 border-t pt-4 space-y-4">
                {brands.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">브랜드</p>
                    <select
                      value={brandId}
                      onChange={(e) => updateParam('brandId', e.target.value)}
                      className="w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">전체</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {tags.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">태그</p>
                    <select
                      value={tagId}
                      onChange={(e) => updateParam('tagId', e.target.value)}
                      className="w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">전체</option>
                      {tags.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">가격</p>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="최소"
                      value={minPrice}
                      onChange={(e) => updateParam('minPrice', e.target.value)}
                      className="w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-400 text-xs shrink-0">~</span>
                    <input
                      type="number"
                      placeholder="최대"
                      value={maxPrice}
                      onChange={(e) => updateParam('maxPrice', e.target.value)}
                      className="w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {attributes.length > 0 && attributes.map((attr) => (
                  <div key={attr.id}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{attr.name}</p>
                    <select
                      value={attrValues.split(',').find((v) => attr.values.some((av) => av.id === v)) || ''}
                      onChange={(e) => {
                        const cur = attrValues ? attrValues.split(',').filter((v) => !attr.values.some((av) => av.id === v)) : [];
                        if (e.target.value) cur.push(e.target.value);
                        updateParam('attrs', cur.join(','));
                      }}
                      className="w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">전체</option>
                      {attr.values.map((v) => (
                        <option key={v.id} value={v.id}>{v.value}</option>
                      ))}
                    </select>
                  </div>
                ))}

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: 'isFeatured', label: '추천', active: isFeatured },
                    { key: 'isNew', label: '신상품', active: isNew },
                    { key: 'isBest', label: '베스트', active: isBest },
                  ].map(({ key, label, active }) => (
                    <button
                      key={key}
                      onClick={() => updateParam(key, active ? '' : 'true')}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        active ? 'bg-blue-600 text-white' : 'border text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {(categoryId || brandId || tagId || minPrice || maxPrice || attrValues || isFeatured || isNew || isBest) && (
                  <button
                    onClick={() => setSearchParams({})}
                    className="w-full rounded-lg border border-red-200 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors"
                  >
                    필터 초기화
                  </button>
                )}
              </div>
            </div>
          </aside>

          {/* ── 메인 컨텐츠 ── */}
          <div className="min-w-0 flex-1">
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
                <button
                  onClick={() => setSearchParams({})}
                  className="text-sm text-blue-600 hover:underline"
                >
                  필터 초기화
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    wishlisted={wishlistIds.has(product.id)}
                    onWishlistToggle={handleWishlistToggle}
                  />
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
        </div>
      </div>
      <PageSection id="product-list-bottom" />
    </>
  );
}
