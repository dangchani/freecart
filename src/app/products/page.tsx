import { useState, useEffect } from 'react';
import { ProductCard } from '@/components/product-card';
import { getProducts } from '@/services/products';
import type { Product } from '@/types';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProducts({ limit: 20 })
      .then(({ data }) => setProducts(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="container py-8 text-center">로딩 중...</div>;

  return (
    <div className="container py-8">
      <h1 className="mb-8 text-3xl font-bold">전체 상품</h1>
      {products.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">등록된 상품이 없습니다.</div>
      )}
    </div>
  );
}
