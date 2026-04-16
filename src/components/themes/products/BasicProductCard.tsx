/**
 * BasicProductCard - 기본 상품 카드
 * 이미지 + 상품명 + 가격
 */

import { Link } from 'react-router-dom';
import { Heart, ShoppingCart } from 'lucide-react';
import { getContrastColor } from '@/lib/utils';

export interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  badge?: string;
  badgeText?: string | null;
  badgeColor?: string | null;
  isNew?: boolean;
  isBest?: boolean;
  onAddToCart?: () => void;
  onToggleWishlist?: () => void;
  isWishlisted?: boolean;
}

export default function BasicProductCard({
  id,
  name,
  price,
  originalPrice,
  image,
  badge,
  badgeText,
  badgeColor,
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
      <Link to={`/products/${id}`} className="block relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover"
        />

        {/* 뱃지 */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {isNew && (
            <span className="px-2 py-1 bg-black text-white text-xs font-medium rounded">NEW</span>
          )}
          {isBest && (
            <span className="px-2 py-1 bg-red-500 text-white text-xs font-medium rounded">BEST</span>
          )}
          {discount > 0 && (
            <span className="px-2 py-1 bg-red-500 text-white text-xs font-medium rounded">{discount}%</span>
          )}
          {badge && (
            <span className="px-2 py-1 bg-gray-800 text-white text-xs font-medium rounded">{badge}</span>
          )}
        </div>

        {/* 하단 띠지 */}
        {badgeText && (
          <div
            className="absolute bottom-0 left-0 right-0 py-1 text-center text-xs font-bold tracking-wide"
            style={{ backgroundColor: badgeColor ?? '#ef4444', color: getContrastColor(badgeColor ?? '#ef4444') }}
          >
            {badgeText}
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onToggleWishlist && (
            <button
              onClick={(e) => {
                e.preventDefault();
                onToggleWishlist();
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                isWishlisted ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Heart className="h-4 w-4" fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>
          )}
          {onAddToCart && (
            <button
              onClick={(e) => {
                e.preventDefault();
                onAddToCart();
              }}
              className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
            </button>
          )}
        </div>
      </Link>

      {/* 정보 */}
      <div className="mt-3">
        <Link to={`/products/${id}`} className="block">
          <h3 className="text-sm text-gray-900 line-clamp-2 hover:underline">{name}</h3>
        </Link>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-lg font-bold text-gray-900">{price.toLocaleString()}원</span>
          {originalPrice && (
            <span className="text-sm text-gray-400 line-through">{originalPrice.toLocaleString()}원</span>
          )}
        </div>
      </div>
    </div>
  );
}
