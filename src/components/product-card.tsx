import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { addToCart } from '@/services/cart';
import { useAuth } from '@/hooks/useAuth';
import { useCartStore } from '@/store/cart';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const primaryImage = product.images?.find((img) => img.isPrimary) || product.images?.[0];
  const thumbnail = primaryImage?.url || '/placeholder.png';
  const hasDiscount = product.regularPrice > product.salePrice;
  const discountPercent = hasDiscount
    ? Math.round(((product.regularPrice - product.salePrice) / product.regularPrice) * 100)
    : 0;
  const isSoldOut = product.stockQuantity === 0;

  async function handleCartClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // 옵션 있는 상품 → 상세 페이지로 이동
    if (product.hasOptions) {
      navigate(`/products/${product.slug}`);
      return;
    }

    if (isSoldOut || adding) return;

    setAdding(true);
    try {
      if (user) {
        await addToCart(user.id, product.id, 1);
      } else {
        useCartStore.getState().addItem(product as any, 1);
      }
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch {
      navigate(`/products/${product.slug}`);
    } finally {
      setAdding(false);
    }
  }

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <Link to={`/products/${product.slug}`}>
        <div className="relative aspect-square overflow-hidden bg-gray-100">
          <img
            src={thumbnail}
            alt={product.name}
            className="h-full w-full object-cover transition-transform hover:scale-105"
            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.png'; }}
          />
          {hasDiscount && (
            <div className="absolute left-2 top-2 rounded-md bg-red-500 px-2 py-1 text-xs font-bold text-white">
              {discountPercent}% OFF
            </div>
          )}
          {isSoldOut && (
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
          <span className="text-lg font-bold">{formatCurrency(product.salePrice)}</span>
          {hasDiscount && (
            <span className="text-sm text-gray-500 line-through">
              {formatCurrency(product.regularPrice)}
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button
          className="w-full"
          variant={added ? 'default' : 'outline'}
          disabled={isSoldOut || adding}
          onClick={handleCartClick}
        >
          {isSoldOut
            ? '품절'
            : adding
            ? '담는 중...'
            : added
            ? '담겼습니다!'
            : product.hasOptions
            ? '옵션 선택'
            : '장바구니 담기'}
        </Button>
      </CardFooter>
    </Card>
  );
}
