/**
 * HoverProductCard - 호버 효과 상품 카드
 * 호버 시 추가 정보/버튼 표시
 */

import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Eye } from 'lucide-react';
import type { ProductCardProps } from './BasicProductCard';

export default function HoverProductCard({
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
      {/* 이미지 */}
      <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
        <Link to={`/products/${id}`}>
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </Link>

        {/* 뱃지 */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {isNew && (
            <span className="px-2 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full">NEW</span>
          )}
          {isBest && (
            <span className="px-2 py-1 bg-orange-500 text-white text-xs font-medium rounded-full">BEST</span>
          )}
          {discount > 0 && (
            <span className="px-2 py-1 bg-red-500 text-white text-xs font-medium rounded-full">-{discount}%</span>
          )}
          {badge && (
            <span className="px-2 py-1 bg-gray-800 text-white text-xs font-medium rounded-full">{badge}</span>
          )}
        </div>

        {/* 위시리스트 버튼 */}
        {onToggleWishlist && (
          <button
            onClick={onToggleWishlist}
            className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              isWishlisted
                ? 'bg-red-500 text-white'
                : 'bg-white/80 text-gray-600 hover:bg-white'
            }`}
          >
            <Heart className="h-5 w-5" fill={isWishlisted ? 'currentColor' : 'none'} />
          </button>
        )}

        {/* 호버 오버레이 */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <Link
            to={`/products/${id}`}
            className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-gray-900 hover:bg-gray-100 transition-colors transform translate-y-4 group-hover:translate-y-0 transition-transform"
          >
            <Eye className="h-5 w-5" />
          </Link>
          {onAddToCart && (
            <button
              onClick={onAddToCart}
              className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-gray-900 hover:bg-gray-100 transition-colors transform translate-y-4 group-hover:translate-y-0 transition-transform delay-75"
            >
              <ShoppingCart className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* 정보 */}
      <div className="mt-4 text-center">
        <Link to={`/products/${id}`}>
          <h3 className="text-sm font-medium text-gray-900 line-clamp-1 hover:underline">{name}</h3>
        </Link>
        <div className="mt-2 flex items-center justify-center gap-2">
          {originalPrice && (
            <span className="text-sm text-gray-400 line-through">{originalPrice.toLocaleString()}원</span>
          )}
          <span className="text-lg font-bold text-gray-900">{price.toLocaleString()}원</span>
        </div>
      </div>
    </div>
  );
}
