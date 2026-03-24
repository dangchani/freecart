import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Tag, Truck, RefreshCw, Shield, Headphones } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  thumbnail?: string;
  images?: string[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface Notice {
  id: string;
  title: string;
  createdAt: string;
}

function ProductCard({ product }: { product: Product }) {
  const hasDiscount = product.comparePrice && product.comparePrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.comparePrice! - product.price) / product.comparePrice!) * 100)
    : 0;
  const imageUrl = product.thumbnail || product.images?.[0] || '/placeholder.png';

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
        <span className="font-bold text-gray-900">{product.price.toLocaleString()}원</span>
        {hasDiscount && (
          <span className="text-xs text-gray-400 line-through">
            {product.comparePrice!.toLocaleString()}원
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

function ProductSection({
  title,
  query,
  badge,
}: {
  title: string;
  query: string;
  badge?: string;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/products?${query}&limit=8`)
      .then((r) => r.json())
      .then((data) => setProducts(data.products || data || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <section className="py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {badge && (
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
              {badge}
            </span>
          )}
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        </div>
        <Link
          to={`/products?${query}`}
          className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          전체보기 <ChevronRight className="h-4 w-4 ml-0.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)
          : products.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => setCategories(data.categories || data || []))
      .catch(() => setCategories([]));

    fetch('/api/notices?limit=3')
      .then((r) => r.json())
      .then((data) => setNotices(data.notices || data || []))
      .catch(() => setNotices([]));
  }, []);

  const categoryIcons = ['🛍️', '👕', '👟', '🏠', '💻', '📱', '🍎', '🎮', '💄', '📚'];

  return (
    <div className="min-h-screen bg-white">
      {/* 공지사항 스트립 */}
      {notices.length > 0 && (
        <div className="bg-blue-600 text-white py-2">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide">
              <span className="text-xs font-bold bg-white text-blue-600 px-2 py-0.5 rounded shrink-0">
                공지
              </span>
              <div className="flex items-center gap-6 text-sm">
                {notices.map((n) => (
                  <Link
                    key={n.id}
                    to={`/notices/${n.id}`}
                    className="hover:underline whitespace-nowrap"
                  >
                    {n.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 히어로 배너 */}
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
              더 나은 쇼핑 경험,
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

      {/* 혜택 아이콘 배너 */}
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
                <div className="flex-shrink-0 text-blue-600 bg-blue-100 p-2 rounded-lg">
                  {item.icon}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4">
        {/* 카테고리 퀵링크 */}
        <section className="py-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">카테고리</h2>
            <Link
              to="/categories"
              className="flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              전체보기 <ChevronRight className="h-4 w-4 ml-0.5" />
            </Link>
          </div>
          {categories.length === 0 ? (
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
              {categories.slice(0, 8).map((cat, idx) => (
                <Link
                  key={cat.id}
                  to={`/categories/${cat.slug}`}
                  className="group flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-blue-50 transition-colors"
                >
                  <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-2xl group-hover:from-blue-200 group-hover:to-indigo-200 transition-colors">
                    {categoryIcons[idx % categoryIcons.length]}
                  </div>
                  <span className="text-xs font-medium text-gray-700 text-center leading-tight">
                    {cat.name}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <hr className="border-gray-100" />

        {/* 추천 상품 */}
        <ProductSection title="추천 상품" query="isFeatured=true" badge="PICK" />

        <hr className="border-gray-100" />

        {/* 신상품 */}
        <ProductSection title="신상품" query="isNew=true" badge="NEW" />

        <hr className="border-gray-100" />

        {/* 베스트 */}
        <ProductSection title="베스트 상품" query="isBest=true" badge="BEST" />

        {/* 배너 섹션 */}
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
      </div>
    </div>
  );
}
