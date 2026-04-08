/**
 * 레이아웃 미리보기 패널
 */

'use client';

import { Suspense } from 'react';
import {
  ThemeLayoutConfig,
  getHeaderComponent,
  getFooterComponent,
  getProductCardComponent,
} from '@/lib/theme';

interface Props {
  config: ThemeLayoutConfig;
}

// 더미 상품 데이터
const dummyProducts = [
  {
    id: '1',
    name: '프리미엄 코튼 티셔츠',
    price: 39000,
    originalPrice: 49000,
    image: 'https://placehold.co/400x400/f3f4f6/9ca3af?text=Product',
    isNew: true,
  },
  {
    id: '2',
    name: '오버핏 데님 재킷',
    price: 89000,
    image: 'https://placehold.co/400x400/f3f4f6/9ca3af?text=Product',
    isBest: true,
  },
  {
    id: '3',
    name: '와이드 슬랙스',
    price: 59000,
    originalPrice: 79000,
    image: 'https://placehold.co/400x400/f3f4f6/9ca3af?text=Product',
  },
  {
    id: '4',
    name: '캐주얼 니트 가디건',
    price: 69000,
    image: 'https://placehold.co/400x400/f3f4f6/9ca3af?text=Product',
  },
];

export default function PreviewPanel({ config }: Props) {
  const HeaderComponent = getHeaderComponent(config.header);
  const FooterComponent = getFooterComponent(config.footer);
  const ProductCard = getProductCardComponent(config.productCard);

  return (
    <div className="transform scale-50 origin-top-left w-[200%]">
      {/* 헤더 미리보기 */}
      {HeaderComponent && (
        <Suspense fallback={<div className="h-16 bg-gray-100 animate-pulse" />}>
          <HeaderComponent siteName="Preview" />
        </Suspense>
      )}

      {/* 상품 카드 미리보기 */}
      <div className="p-8 bg-white">
        <h3 className="text-lg font-bold mb-4">상품 카드</h3>
        <div className="grid grid-cols-2 gap-4">
          <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-lg" />}>
            {dummyProducts.slice(0, 2).map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </Suspense>
        </div>
      </div>

      {/* 푸터 미리보기 */}
      {FooterComponent && (
        <Suspense fallback={<div className="h-48 bg-gray-100 animate-pulse" />}>
          <FooterComponent siteName="Preview" />
        </Suspense>
      )}
    </div>
  );
}
