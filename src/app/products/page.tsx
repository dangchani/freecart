import { ProductCard } from '@/components/product-card';
import { getProducts } from '@/services/products';

export default async function ProductsPage() {
  const { data: products } = await getProducts({ limit: 20 });

  return (
    <div className="container py-8">
      <h1 className="mb-8 text-3xl font-bold">전체 상품</h1>

      {products && products.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          등록된 상품이 없습니다.
        </div>
      )}
    </div>
  );
}
