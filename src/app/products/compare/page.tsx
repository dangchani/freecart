import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, Star } from 'lucide-react';

interface ProductCompare {
  id: string;
  name: string;
  slug: string;
  price: number;
  originalPrice?: number;
  thumbnail: string;
  rating?: number;
  reviewCount?: number;
  stock: number;
  isActive: boolean;
  specs?: Record<string, string>;
  category?: string;
  brand?: string;
  description?: string;
}

function CompareContent() {
  const [searchParams] = useSearchParams();
  const idsParam = searchParams.get('ids') || '';
  const productIds = idsParam.split(',').filter(Boolean);

  const [products, setProducts] = useState<ProductCompare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (productIds.length === 0) {
      setLoading(false);
      return;
    }
    loadComparison();
  }, [idsParam]);

  async function loadComparison() {
    try {
      setLoading(true);
      const response = await fetch(`/api/products/compare?ids=${idsParam}`);
      const data = await response.json();
      if (data.success) {
        setProducts(data.data || []);
      } else {
        setError(data.error || '상품 정보를 불러오지 못했습니다.');
      }
    } catch {
      setError('상품 비교 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="container py-8 text-center">로딩 중...</div>;
  }

  if (error) {
    return (
      <div className="container py-8">
        <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      </div>
    );
  }

  if (productIds.length === 0) {
    return (
      <div className="container py-8 text-center">
        <p className="mb-4 text-gray-500">비교할 상품이 선택되지 않았습니다.</p>
        <Link to="/products">
          <Button>상품 목록으로</Button>
        </Link>
      </div>
    );
  }

  // Collect all spec keys across products
  const allSpecKeys = Array.from(
    new Set(products.flatMap((p) => Object.keys(p.specs || {})))
  );

  const comparisonRows: { label: string; values: (string | React.ReactNode)[] }[] = [
    {
      label: '가격',
      values: products.map((p) => (
        <div key={p.id}>
          <span className="font-bold text-gray-900">{formatCurrency(p.price)}</span>
          {p.originalPrice && p.originalPrice > p.price && (
            <span className="ml-2 text-sm text-gray-400 line-through">
              {formatCurrency(p.originalPrice)}
            </span>
          )}
        </div>
      )),
    },
    {
      label: '평점',
      values: products.map((p) => (
        <div key={p.id} className="flex items-center gap-1">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span>{p.rating?.toFixed(1) ?? '-'}</span>
          {p.reviewCount != null && (
            <span className="text-xs text-gray-500">({p.reviewCount})</span>
          )}
        </div>
      )),
    },
    {
      label: '재고',
      values: products.map((p) => (
        <span key={p.id} className={p.stock > 0 ? 'text-green-600' : 'text-red-500'}>
          {p.stock > 0 ? `${p.stock}개` : '품절'}
        </span>
      )),
    },
    {
      label: '카테고리',
      values: products.map((p) => p.category || '-'),
    },
    {
      label: '브랜드',
      values: products.map((p) => p.brand || '-'),
    },
    ...allSpecKeys.map((key) => ({
      label: key,
      values: products.map((p) => p.specs?.[key] || '-'),
    })),
  ];

  return (
    <div className="container py-8">
      <Link
        to="/products"
        className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        상품 목록으로 돌아가기
      </Link>

      <h1 className="mb-6 text-3xl font-bold">상품 비교</h1>

      {products.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">비교할 상품 정보를 찾을 수 없습니다.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="w-32 px-4 py-3 text-left font-medium text-gray-600 bg-gray-50 border-b">
                  항목
                </th>
                {products.map((product) => (
                  <th key={product.id} className="px-4 py-3 text-center border-b bg-white">
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative h-24 w-24 overflow-hidden rounded-lg bg-gray-100">
                        <img
                          src={product.thumbnail || '/placeholder.png'}
                          alt={product.name}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <Link
                        to={`/products/${product.slug}`}
                        className="font-medium text-gray-900 hover:text-blue-600 text-sm line-clamp-2"
                      >
                        {product.name}
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-4 py-3 font-medium text-gray-700 border-r">{row.label}</td>
                  {row.values.map((value, vIdx) => (
                    <td key={vIdx} className="px-4 py-3 text-center text-gray-800">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-4 py-3 border-t bg-gray-50" />
                {products.map((product) => (
                  <td key={product.id} className="px-4 py-3 text-center border-t">
                    <Link to={`/products/${product.slug}`}>
                      <Button size="sm">상품 보기</Button>
                    </Link>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ProductComparePage() {
  return (
    <Suspense fallback={<div className="container py-8 text-center">로딩 중...</div>}>
      <CompareContent />
    </Suspense>
  );
}
