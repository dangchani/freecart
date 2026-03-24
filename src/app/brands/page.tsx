import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Tag } from 'lucide-react';

interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  productCount?: number;
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/brands')
      .then((r) => r.json())
      .then((data) => setBrands(data.brands || data || []))
      .catch(() => setBrands([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Tag className="h-8 w-8 text-blue-600" />
          브랜드
        </h1>
        <p className="text-gray-500 mt-2">다양한 브랜드 상품을 만나보세요.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-5 animate-pulse">
              <div className="aspect-video bg-gray-200 rounded-lg mb-3" />
              <div className="h-4 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : brands.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <Tag className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">등록된 브랜드가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              to={`/brands/${brand.id}`}
              className="group flex flex-col items-center border rounded-xl p-5 hover:shadow-md hover:border-blue-300 transition-all bg-white"
            >
              <div className="w-full aspect-video relative mb-3 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center">
                {brand.logoUrl ? (
                  <img
                    src={brand.logoUrl}
                    alt={brand.name}
                    className="object-contain p-2 group-hover:scale-105 transition-transform w-full h-full"
                  />
                ) : (
                  <span className="text-3xl font-extrabold text-gray-200">
                    {brand.name.charAt(0)}
                  </span>
                )}
              </div>
              <p className="font-semibold text-gray-900 text-sm text-center group-hover:text-blue-600 transition-colors">
                {brand.name}
              </p>
              {brand.productCount !== undefined && (
                <p className="text-xs text-gray-400 mt-0.5">{brand.productCount}개 상품</p>
              )}
              {brand.description && (
                <p className="text-xs text-gray-500 mt-1 text-center line-clamp-2">
                  {brand.description}
                </p>
              )}
              <span className="mt-2 text-xs text-blue-600 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                상품 보기 <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
