/**
 * ListSection - 리스트 섹션
 * 세로 리스트 형태로 상품 표시
 */

import { Link } from 'react-router-dom';
import { ChevronRight, Heart, ShoppingCart } from 'lucide-react';
import type { ProductCardProps } from '../products/BasicProductCard';

interface Props {
  title: string;
  subtitle?: string;
  products: ProductCardProps[];
  moreLink?: string;
  moreLinkText?: string;
  showRank?: boolean;
  onAddToCart?: (productId: string) => void;
  onToggleWishlist?: (productId: string) => void;
  wishlistIds?: string[];
}

export default function ListSection({
  title,
  subtitle,
  products,
  moreLink,
  moreLinkText = '더보기',
  showRank = false,
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

      {/* 리스트 */}
      <div className="space-y-4">
        {products.map((product, index) => {
          const discount = product.originalPrice
            ? Math.round((1 - product.price / product.originalPrice) * 100)
            : 0;

          return (
            <div
              key={product.id}
              className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-lg hover:shadow-md transition-shadow"
            >
              {/* 순위 */}
              {showRank && (
                <div className="flex-shrink-0 w-8 text-center">
                  <span className={`text-xl font-bold ${index < 3 ? 'text-red-500' : 'text-gray-400'}`}>
                    {index + 1}
                  </span>
                </div>
              )}

              {/* 이미지 */}
              <Link to={`/products/${product.id}`} className="flex-shrink-0">
                <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </Link>

              {/* 정보 */}
              <div className="flex-1 min-w-0">
                <Link to={`/products/${product.id}`}>
                  <h3 className="text-sm font-medium text-gray-900 line-clamp-1 hover:underline">
                    {product.name}
                  </h3>
                </Link>
                <div className="mt-1 flex items-baseline gap-2">
                  {discount > 0 && (
                    <span className="text-sm font-bold text-red-500">{discount}%</span>
                  )}
                  <span className="text-lg font-bold text-gray-900">
                    {product.price.toLocaleString()}원
                  </span>
                  {product.originalPrice && (
                    <span className="text-sm text-gray-400 line-through">
                      {product.originalPrice.toLocaleString()}원
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  {product.isNew && (
                    <span className="px-1.5 py-0.5 bg-black text-white text-[10px] font-medium rounded">NEW</span>
                  )}
                  {product.isBest && (
                    <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-medium rounded">BEST</span>
                  )}
                </div>
              </div>

              {/* 액션 */}
              <div className="flex-shrink-0 flex items-center gap-2">
                {onToggleWishlist && (
                  <button
                    onClick={() => onToggleWishlist(product.id)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      wishlistIds.includes(product.id)
                        ? 'bg-red-50 text-red-500'
                        : 'bg-gray-50 text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <Heart
                      className="h-5 w-5"
                      fill={wishlistIds.includes(product.id) ? 'currentColor' : 'none'}
                    />
                  </button>
                )}
                {onAddToCart && (
                  <button
                    onClick={() => onAddToCart(product.id)}
                    className="w-10 h-10 bg-gray-900 text-white rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors"
                  >
                    <ShoppingCart className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
