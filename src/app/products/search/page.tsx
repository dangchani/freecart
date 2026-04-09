import { useState, useEffect, useRef, Suspense } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { PageSection } from '@/components/theme/PageSection';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Search, X, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { dispatchThemeEvent } from '@/lib/theme';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  thumbnail?: string;
  images: string[];
  stock: number;
}

type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'popular';

const sortLabels: Record<SortOption, string> = {
  newest: '최신순',
  price_asc: '낮은가격순',
  price_desc: '높은가격순',
  popular: '인기순',
};

function SearchPageContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQ);
  const [inputValue, setInputValue] = useState(initialQ);
  const [products, setProducts] = useState<Product[]>([]);
  const [autocomplete, setAutocomplete] = useState<string[]>([]);
  const [popularKeywords, setPopularKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const autocompleteTimeout = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPopularKeywords();
  }, []);

  useEffect(() => {
    if (query) {
      fetchProducts(query, sortBy);
    } else {
      setProducts([]);
    }
  }, [query, sortBy]);

  async function fetchPopularKeywords() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('search_keywords')
        .select('keyword')
        .order('count', { ascending: false })
        .limit(10);

      if (error) throw error;
      setPopularKeywords((data || []).map((k: any) => k.keyword));
    } catch (err) {
      console.error('인기 키워드 로딩 실패:', err);
    }
  }

  async function fetchProducts(q: string, sort: SortOption) {
    setLoading(true);
    dispatchThemeEvent('search', { query: q, sort });
    try {
      const supabase = createClient();
      let query_ = supabase
        .from('products')
        .select('id, name, slug, sale_price, regular_price, stock_quantity, product_images(url, is_primary)')
        .eq('status', 'active')
        .ilike('name', `%${q}%`);

      if (sort === 'newest') query_ = query_.order('created_at', { ascending: false });
      else if (sort === 'price_asc') query_ = query_.order('sale_price', { ascending: true });
      else if (sort === 'price_desc') query_ = query_.order('sale_price', { ascending: false });
      else if (sort === 'popular') query_ = query_.order('sales_count', { ascending: false });

      const { data, error } = await query_;
      if (error) throw error;

      setProducts(
        (data || []).map((p: any) => {
          const primaryImg = (p.product_images || []).find((i: any) => i.is_primary);
          const firstImg = (p.product_images || [])[0];
          return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: p.sale_price,
            comparePrice: p.regular_price,
            thumbnail: primaryImg?.url || firstImg?.url,
            images: (p.product_images || []).map((i: any) => i.url),
            stock: p.stock_quantity,
          };
        })
      );
    } catch (err) {
      console.error('상품 검색 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(value: string) {
    setInputValue(value);
    if (autocompleteTimeout.current) clearTimeout(autocompleteTimeout.current);
    if (value.trim().length < 1) {
      setAutocomplete([]);
      setShowAutocomplete(false);
      return;
    }
    autocompleteTimeout.current = setTimeout(async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('search_keywords')
          .select('keyword')
          .ilike('keyword', `${value}%`)
          .order('count', { ascending: false })
          .limit(8);

        if (error) throw error;
        const keywords = (data || []).map((k: any) => k.keyword);
        setAutocomplete(keywords);
        setShowAutocomplete(keywords.length > 0);
      } catch {
        // ignore
      }
    }, 200);
  }

  function handleSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setInputValue(trimmed);
    setShowAutocomplete(false);
    navigate(`/products/search?q=${encodeURIComponent(trimmed)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch(inputValue);
    if (e.key === 'Escape') setShowAutocomplete(false);
  }

  return (
    <>
      <PageSection id="search" />
      <div className="container py-8">
      <h1 className="mb-6 text-3xl font-bold">상품 검색</h1>

      {/* 검색 입력 */}
      <div className="relative mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => inputValue && autocomplete.length > 0 && setShowAutocomplete(true)}
              onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
              placeholder="검색어를 입력하세요"
              className="w-full rounded-md border py-3 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {inputValue && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => { setInputValue(''); setQuery(''); setShowAutocomplete(false); }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button onClick={() => handleSearch(inputValue)} className="px-6">
            검색
          </Button>
        </div>

        {/* 자동완성 드롭다운 */}
        {showAutocomplete && autocomplete.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg">
            {autocomplete.map((keyword, i) => (
              <button
                key={i}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50"
                onMouseDown={() => handleSearch(keyword)}
              >
                <Search className="h-3.5 w-3.5 text-gray-400" />
                {keyword}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 인기 키워드 */}
      {!query && popularKeywords.length > 0 && (
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-600">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            인기 검색어
          </div>
          <div className="flex flex-wrap gap-2">
            {popularKeywords.map((kw, i) => (
              <button
                key={i}
                onClick={() => handleSearch(kw)}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm hover:bg-gray-50 hover:border-blue-300 transition-colors"
              >
                <span className="text-xs font-bold text-orange-500">{i + 1}</span>
                {kw}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 검색 결과 */}
      {query && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              <strong>&quot;{query}&quot;</strong> 검색 결과{' '}
              {!loading && <span className="text-blue-600 font-medium">{products.length}개</span>}
            </p>
            <div className="flex gap-1">
              {(Object.keys(sortLabels) as SortOption[]).map((sort) => (
                <Button
                  key={sort}
                  variant={sortBy === sort ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSortBy(sort)}
                  className="text-xs"
                >
                  {sortLabels[sort]}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">검색 중...</div>
          ) : products.length === 0 ? (
            <Card className="p-12 text-center">
              <Search className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <p className="mb-2 font-medium text-gray-700">&quot;{query}&quot; 검색 결과가 없습니다.</p>
              <p className="text-sm text-gray-500">다른 검색어로 시도해보세요.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {products.map((product) => {
                const hasDiscount = product.comparePrice && product.comparePrice > product.price;
                const discountPercent = hasDiscount
                  ? Math.round(((product.comparePrice! - product.price) / product.comparePrice!) * 100)
                  : 0;
                const imageUrl = product.thumbnail || product.images?.[0] || '/placeholder.png';

                return (
                  <Link key={product.id} to={`/products/${product.slug}`}>
                    <Card className="overflow-hidden hover:shadow-md transition-shadow">
                      <div className="relative aspect-square bg-gray-100">
                        <img
                          src={imageUrl}
                          alt={product.name}
                          className="object-cover w-full h-full"
                        />
                        {hasDiscount && (
                          <span className="absolute left-2 top-2 rounded bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">
                            {discountPercent}%
                          </span>
                        )}
                        {product.stock === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <span className="text-sm text-white">품절</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="mb-1 line-clamp-2 text-sm">{product.name}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">{formatCurrency(product.price)}</span>
                          {hasDiscount && (
                            <span className="text-xs text-gray-400 line-through">
                              {formatCurrency(product.comparePrice!)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container py-8 text-center text-gray-500">로딩 중...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}
