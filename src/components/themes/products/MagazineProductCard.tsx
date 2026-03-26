/**
 * MagazineProductCard - 매거진 스타일 상품 카드
 * 큰 이미지 + 세련된 타이포그래피
 */

import { Link } from 'react-router-dom';
import { Heart, Plus } from 'lucide-react';
import type { ProductCardProps } from './BasicProductCard';

export default function MagazineProductCard({
  id,
  name,
  price,
  originalPrice,
  image,
  badge,
  isNew,
  isBest,
  onAddToCart,
  onToggleWishlist,
  isWishlisted,
}: ProductCardProps) {
  const discount = originalPrice ? Math.round((1 - price / originalPrice) * 100) : 0;

  return (
    <div className="group">
      {/* 이미지 - 4:5 비율 */}
      <div className="relative aspect-[4/5] bg-gray-50 overflow-hidden">
        <Link to={`/products/${id}`}>
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover"
          />
        </Link>

        {/* 상단 뱃지 */}
        {(isNew || isBest || discount > 0) && (
          <div className="absolute top-4 left-4">
            {isNew && (
              <span className="inline-block px-3 py-1.5 bg-black text-white text-[10px] font-medium tracking-wider uppercase">
                New Arrival
              </span>
            )}
            {isBest && !isNew && (
              <span className="inline-block px-3 py-1.5 bg-black text-white text-[10px] font-medium tracking-wider uppercase">
                Best Seller
              </span>
            )}
            {discount > 0 && !isNew && !isBest && (
              <span className="inline-block px-3 py-1.5 bg-red-600 text-white text-[10px] font-medium tracking-wider uppercase">
                {discount}% Off
              </span>
            )}
          </div>
        )}

        {/* 위시리스트 */}
        {onToggleWishlist && (
          <button
            onClick={onToggleWishlist}
            className={`absolute top-4 right-4 transition-opacity ${
              isWishlisted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <Heart
              className={`h-6 w-6 ${isWishlisted ? 'text-red-500 fill-red-500' : 'text-gray-800'}`}
            />
          </button>
        )}

        {/* 퀵 추가 버튼 */}
        {onAddToCart && (
          <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onAddToCart}
              className="w-full py-3 bg-white text-gray-900 text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
            >
              <Plus className="h-4 w-4" />
              장바구니 담기
            </button>
          </div>
        )}
      </div>

      {/* 정보 */}
      <div className="mt-5">
        <Link to={`/products/${id}`}>
          <h3 className="text-base font-light text-gray-900 tracking-wide line-clamp-1 hover:underline">
            {name}
          </h3>
        </Link>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-base font-medium text-gray-900">{price.toLocaleString()}원</span>
          {originalPrice && (
            <span className="text-sm text-gray-400 line-through">{originalPrice.toLocaleString()}원</span>
          )}
        </div>
        {badge && (
          <p className="mt-2 text-xs text-gray-500 tracking-wide">{badge}</p>
        )}
      </div>
    </div>
  );
}
