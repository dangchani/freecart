import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getProductBySlug } from '@/services/products';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';

export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const product = await getProductBySlug(params.slug);

  if (!product) {
    notFound();
  }

  const hasDiscount = product.comparePrice && product.comparePrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.comparePrice! - product.price) / product.comparePrice!) * 100)
    : 0;

  return (
    <div className="container py-8">
      <div className="grid gap-8 md:grid-cols-2">
        {/* 이미지 */}
        <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
          <Image
            src={product.thumbnail || product.images[0] || '/placeholder.png'}
            alt={product.name}
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* 상품 정보 */}
        <div className="flex flex-col">
          <h1 className="mb-4 text-3xl font-bold">{product.name}</h1>

          <div className="mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold">{formatCurrency(product.price)}</span>
              {hasDiscount && (
                <>
                  <span className="text-xl text-gray-500 line-through">
                    {formatCurrency(product.comparePrice!)}
                  </span>
                  <span className="rounded-md bg-red-500 px-2 py-1 text-sm font-bold text-white">
                    {discountPercent}% OFF
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="mb-6 border-t border-b py-4">
            <div className="mb-2 flex justify-between">
              <span className="text-gray-600">배송비</span>
              <span>3,000원 (50,000원 이상 무료)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">재고</span>
              <span>{product.stock > 0 ? `${product.stock}개` : '품절'}</span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="mb-4 text-lg font-semibold">상품 설명</h2>
            <p className="whitespace-pre-wrap text-gray-600">{product.description}</p>
          </div>

          <div className="mt-auto flex gap-4">
            <Button size="lg" className="flex-1" disabled={product.stock === 0}>
              {product.stock === 0 ? '품절' : '장바구니 담기'}
            </Button>
            <Button size="lg" variant="outline" className="flex-1" disabled={product.stock === 0}>
              바로 구매
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
