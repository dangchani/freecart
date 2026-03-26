/**
 * Grid3 - 3열 그리드
 */

import { ComponentType } from 'react';
import type { ProductCardProps } from '../products/BasicProductCard';

interface Props {
  products: ProductCardProps[];
  CardComponent: ComponentType<ProductCardProps>;
  onAddToCart?: (productId: string) => void;
  onToggleWishlist?: (productId: string) => void;
  wishlistIds?: string[];
}

export default function Grid3({
  products,
  CardComponent,
  onAddToCart,
  onToggleWishlist,
  wishlistIds = [],
}: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
      {products.map((product) => (
        <CardComponent
          key={product.id}
          {...product}
          onAddToCart={onAddToCart ? () => onAddToCart(product.id) : undefined}
          onToggleWishlist={onToggleWishlist ? () => onToggleWishlist(product.id) : undefined}
          isWishlisted={wishlistIds.includes(product.id)}
        />
      ))}
    </div>
  );
}
