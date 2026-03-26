/**
 * MasonryGrid - 메이슨리 그리드
 * 핀터레스트 스타일 배치
 */

import { ComponentType, useMemo } from 'react';
import type { ProductCardProps } from '../products/BasicProductCard';

interface Props {
  products: ProductCardProps[];
  CardComponent: ComponentType<ProductCardProps>;
  onAddToCart?: (productId: string) => void;
  onToggleWishlist?: (productId: string) => void;
  wishlistIds?: string[];
  columns?: number;
}

export default function MasonryGrid({
  products,
  CardComponent,
  onAddToCart,
  onToggleWishlist,
  wishlistIds = [],
  columns = 4,
}: Props) {
  // 컬럼별로 상품 분배
  const columnProducts = useMemo(() => {
    const cols: ProductCardProps[][] = Array.from({ length: columns }, () => []);
    products.forEach((product, index) => {
      cols[index % columns].push(product);
    });
    return cols;
  }, [products, columns]);

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
      }}
    >
      {columnProducts.map((colProducts, colIndex) => (
        <div key={colIndex} className="flex flex-col gap-4">
          {colProducts.map((product, rowIndex) => (
            <div
              key={product.id}
              className="w-full"
              style={{
                // 홀수/짝수 컬럼에 따라 다른 비율 적용
                aspectRatio: rowIndex % 2 === colIndex % 2 ? '3/4' : '4/5',
              }}
            >
              <div className="h-full">
                <CardComponent
                  {...product}
                  onAddToCart={onAddToCart ? () => onAddToCart(product.id) : undefined}
                  onToggleWishlist={onToggleWishlist ? () => onToggleWishlist(product.id) : undefined}
                  isWishlisted={wishlistIds.includes(product.id)}
                />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
