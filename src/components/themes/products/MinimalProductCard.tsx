/**
 * MinimalProductCard - 미니멀 상품 카드
 * 최소한의 정보만 표시
 */

import { Link } from 'react-router-dom';
import type { ProductCardProps } from './BasicProductCard';
import { getContrastColor } from '@/lib/utils';

export default function MinimalProductCard({
  id,
  name,
  price,
  originalPrice,
  image,
  badgeText,
  badgeColor,
}: ProductCardProps) {
  return (
    <Link to={`/products/${id}`} className="group block">
      {/* 이미지 - 1:1 비율 */}
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
        />

        {/* 하단 띠지 */}
        {badgeText && (
          <div
            className="absolute bottom-0 left-0 right-0 py-1 text-center text-xs font-bold tracking-wide"
            style={{ backgroundColor: badgeColor ?? '#ef4444', color: getContrastColor(badgeColor ?? '#ef4444') }}
          >
            {badgeText}
          </div>
        )}
      </div>

      {/* 정보 */}
      <div className="mt-3 space-y-1">
        <h3 className="text-sm text-gray-700 line-clamp-1 group-hover:text-black transition-colors">
          {name}
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-gray-900">{price.toLocaleString()}원</span>
          {originalPrice && (
            <span className="text-xs text-gray-400 line-through">{originalPrice.toLocaleString()}원</span>
          )}
        </div>
      </div>
    </Link>
  );
}
