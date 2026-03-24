import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const thumbnail = product.thumbnail || product.images[0] || '/placeholder.png';
  const hasDiscount = product.comparePrice && product.comparePrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.comparePrice! - product.price) / product.comparePrice!) * 100)
    : 0;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <Link to={`/products/${product.slug}`}>
        <div className="relative aspect-square overflow-hidden bg-gray-100">
          <img
            src={thumbnail}
            alt={product.name}
            className="h-full w-full object-cover transition-transform hover:scale-105"
          />
          {hasDiscount && (
            <div className="absolute left-2 top-2 rounded-md bg-red-500 px-2 py-1 text-xs font-bold text-white">
              {discountPercent}% OFF
            </div>
          )}
          {product.stock === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="text-lg font-bold text-white">품절</span>
            </div>
          )}
        </div>
      </Link>

      <CardContent className="p-4">
        <Link to={`/products/${product.slug}`}>
          <h3 className="mb-2 line-clamp-2 font-medium hover:text-primary">{product.name}</h3>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{formatCurrency(product.price)}</span>
          {hasDiscount && (
            <span className="text-sm text-gray-500 line-through">
              {formatCurrency(product.comparePrice!)}
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button className="w-full" disabled={product.stock === 0}>
          {product.stock === 0 ? '품절' : '장바구니 담기'}
        </Button>
      </CardFooter>
    </Card>
  );
}
