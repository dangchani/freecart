/**
 * SliderGrid - 슬라이더 그리드
 * 좌우 스크롤 방식
 */

import { useState, useRef, ComponentType } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ProductCardProps } from '../products/BasicProductCard';

interface Props {
  products: ProductCardProps[];
  CardComponent: ComponentType<ProductCardProps>;
  onAddToCart?: (productId: string) => void;
  onToggleWishlist?: (productId: string) => void;
  wishlistIds?: string[];
  itemsToShow?: number;
}

export default function SliderGrid({
  products,
  CardComponent,
  onAddToCart,
  onToggleWishlist,
  wishlistIds = [],
  itemsToShow = 4,
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
    <div className="relative group/slider">
      {/* 네비게이션 버튼 */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center text-gray-600 hover:text-gray-900 transition-all opacity-0 group-hover/slider:opacity-100 -translate-x-1/2"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center text-gray-600 hover:text-gray-900 transition-all opacity-0 group-hover/slider:opacity-100 translate-x-1/2"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* 슬라이더 컨테이너 */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
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
    </div>
  );
}
