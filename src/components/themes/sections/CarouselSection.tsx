/**
 * CarouselSection - 캐러셀 섹션
 * 타이틀 + 상품 슬라이더
 */

import { useState, useRef, ComponentType, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ProductCardProps } from '../products/BasicProductCard';

interface Props {
  title: string;
  subtitle?: string;
  products: ProductCardProps[];
  CardComponent: ComponentType<ProductCardProps>;
  itemsToShow?: number;
  moreLink?: string;
  moreLinkText?: string;
  onAddToCart?: (productId: string) => void;
  onToggleWishlist?: (productId: string) => void;
  wishlistIds?: string[];
}

export default function CarouselSection({
  title,
  subtitle,
  products,
  CardComponent,
  itemsToShow = 4,
  moreLink,
  moreLinkText = '더보기',
  onAddToCart,
  onToggleWishlist,
  wishlistIds = [],
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const cardWidth = scrollRef.current.clientWidth / itemsToShow;
      const scrollAmount = cardWidth * 2;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

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
        <div className="flex items-center gap-4">
          {/* 네비게이션 */}
          <div className="hidden md:flex gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="w-10 h-10 border border-gray-300 rounded-full flex items-center justify-center text-gray-600 hover:border-gray-900 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="w-10 h-10 border border-gray-300 rounded-full flex items-center justify-center text-gray-600 hover:border-gray-900 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
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
      </div>

      {/* 캐러셀 */}
      <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-lg" />}>
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
          style={{
            scrollSnapType: 'x mandatory',
          }}
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="flex-shrink-0 scroll-snap-align-start"
              style={{
                width: `calc((100% - ${(itemsToShow - 1) * 16}px) / ${itemsToShow})`,
                minWidth: '200px',
              }}
            >
              <CardComponent
                {...product}
                onAddToCart={onAddToCart ? () => onAddToCart(product.id) : undefined}
                onToggleWishlist={onToggleWishlist ? () => onToggleWishlist(product.id) : undefined}
                isWishlisted={wishlistIds.includes(product.id)}
              />
            </div>
          ))}
        </div>
      </Suspense>
    </section>
  );
}
