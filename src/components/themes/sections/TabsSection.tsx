/**
 * TabsSection - 탭 섹션
 * 탭으로 카테고리별 상품 표시
 */

import { useState, ComponentType, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { ProductCardProps } from '../products/BasicProductCard';

interface TabItem {
  id: string;
  label: string;
  products: ProductCardProps[];
}

interface Props {
  title: string;
  subtitle?: string;
  tabs: TabItem[];
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

export default function TabsSection({
  title,
  subtitle,
  tabs,
  CardComponent,
  columns = 4,
  moreLink,
  moreLinkText = '더보기',
  onAddToCart,
  onToggleWishlist,
  wishlistIds = [],
}: Props) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || '');

  const activeTabData = tabs.find((tab) => tab.id === activeTab);

  return (
    <section className="py-12">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-gray-500">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* 탭 */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {moreLink && (
            <Link
              to={moreLink}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap"
            >
              {moreLinkText}
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {/* 상품 그리드 */}
      <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-lg" />}>
        <div className={`grid ${gridClasses[columns]} gap-4 md:gap-6`}>
          {activeTabData?.products.map((product) => (
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
