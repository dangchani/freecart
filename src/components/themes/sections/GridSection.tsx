/**
 * GridSection - 그리드 섹션
 * 타이틀 + 상품 그리드
 */

import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ComponentType, Suspense } from 'react';
import type { ProductCardProps } from '../products/BasicProductCard';

interface Props {
  title: string;
  subtitle?: string;
  products: ProductCardProps[];
  CardComponent: ComponentType<ProductCardProps>;
  columns?: 2 | 3 | 4 | 5;
  moreLink?: string;
  moreLinkText?: string;
  onAddToCart?: (productId: string) => void;
  onToggleWishlist?: (productId: string) => void;
  wishlistIds?: string[];
}

const gridClasses = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
  5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
};

export default function GridSection({
  title,
  subtitle,
  products,
  CardComponent,
  columns = 4,
  moreLink,
  moreLinkText = '더보기',
  onAddToCart,
  onToggleWishlist,
  wishlistIds = [],
}: Props) {
  return (
    <section className="py-12">
      {/* 헤더 */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-gray-500">{subtitle}</p>
          )}
        </div>
        {moreLink && (
          <Link
            to={moreLink}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            {moreLinkText}
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* 그리드 */}
      <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-lg" />}>
        <div className={`grid ${gridClasses[columns]} gap-4 md:gap-6`}>
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
      </Suspense>
    </section>
  );
}
