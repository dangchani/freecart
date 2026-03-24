import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Tag } from 'lucide-react';

interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  website?: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  thumbnail?: string;
  images?: string[];
}

export default function BrandProductsPage() {
  const { id } = useParams<{ id: string }>();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/brands/${id}`)
        .then((r) => r.json())
        .then((data) => {
          if (!data || data.error) setNotFound(true);
          else setBrand(data.brand || data);
        })
        .catch(() => setNotFound(true))
        .finally(() => setLoading(false)),

      fetch(`/api/products?brandId=${id}`)
        .then((r) => r.json())
        .then((data) => setProducts(data.products || data || []))
        .catch(() => setProducts([]))
        .finally(() => setProductsLoading(false)),
    ]);
  }, [id]);

  if (!loading && notFound) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 mb-4">브랜드를 찾을 수 없습니다.</p>
        <Link to="/brands" className="text-blue-600 hover:underline flex items-center justify-center gap-1">
          <ArrowLeft className="h-4 w-4" /> 브랜드 목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link to="/brands" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="h-4 w-4 mr-1" /> 브랜드 목록
      </Link>

      {/* 브랜드 헤더 */}
      {loading ? (
        <div className="mb-10 flex items-center gap-6">
          <div className="w-24 h-24 rounded-xl bg-gray-200 animate-pulse shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-7 w-40 bg-gray-200 animate-pulse rounded" />
            <div className="h-4 w-64 bg-gray-200 animate-pulse rounded" />
          </div>
        </div>
      ) : brand ? (
        <div className="mb-10 flex items-center gap-6 p-6 bg-white border rounded-2xl shadow-sm">
          <div className="w-24 h-24 relative shrink-0 bg-gray-50 rounded-xl overflow-hidden border flex items-center justify-center">
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt={brand.name} className="object-contain p-2 w-full h-full" />
            ) : (
              <span className="text-3xl font-extrabold text-gray-300">
                {brand.name.charAt(0)}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Tag className="h-6 w-6 text-blue-600" />
              {brand.name}
            </h1>
            {brand.description && (
              <p className="text-gray-500 text-sm mt-1">{brand.description}</p>
            )}
            {brand.website && (
              <a
                href={brand.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 text-sm hover:underline mt-1 inline-block"
              >
                공식 웹사이트 →
              </a>
            )}
          </div>
        </div>
      ) : null}

      {/* 상품 그리드 */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-5">
          {brand?.name} 상품{' '}
          {!productsLoading && (
            <span className="text-gray-400 font-normal text-base">({products.length})</span>
          )}
        </h2>
        {productsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-square rounded-xl bg-gray-200 animate-pulse mb-2" />
                <div className="h-4 bg-gray-200 animate-pulse rounded mb-1" />
                <div className="h-4 w-1/2 bg-gray-200 animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p>등록된 상품이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {products.map((product) => {
              const imageUrl = product.thumbnail || product.images?.[0] || '/placeholder.png';
              const hasDiscount = product.comparePrice && product.comparePrice > product.price;
              const discountPercent = hasDiscount
                ? Math.round(((product.comparePrice! - product.price) / product.comparePrice!) * 100)
                : 0;

              return (
                <Link key={product.id} to={`/products/${product.slug}`} className="group block">
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-100 mb-3">
                    <img
                      src={imageUrl}
                      alt={product.name}
                      className="object-cover transition-transform duration-300 group-hover:scale-105 w-full h-full"
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
                    <span className="font-bold text-gray-900 text-sm">
                      {product.price.toLocaleString()}원
                    </span>
                    {hasDiscount && (
                      <span className="text-xs text-gray-400 line-through">
                        {product.comparePrice!.toLocaleString()}원
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
