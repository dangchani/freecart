/**
 * GridBanner - 그리드 배너
 * 여러 배너를 그리드 형태로 배치
 */

import { Link } from 'react-router-dom';
import type { BannerItem } from './FullwidthBanner';

interface Props {
  banners: BannerItem[];
  layout?: '2x1' | '1x2' | '2x2' | '1-2' | '2-1';
}

export default function GridBanner({ banners, layout = '2x2' }: Props) {
  if (banners.length === 0) return null;

  const renderBanner = (banner: BannerItem, className?: string) => {
    const textColor = banner.textColor === 'dark' ? 'text-gray-900' : 'text-white';

    const Content = () => (
      <div className={`relative overflow-hidden group ${className}`}>
        <img
          src={banner.image}
          alt={banner.title || ''}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />

        {(banner.title || banner.subtitle) && (
          <div className="absolute inset-0 flex flex-col justify-end p-6">
            {banner.subtitle && (
              <p className={`text-sm ${textColor} opacity-80`}>{banner.subtitle}</p>
            )}
            {banner.title && (
              <h3 className={`text-xl md:text-2xl font-bold ${textColor}`}>{banner.title}</h3>
            )}
          </div>
        )}
      </div>
    );

    return banner.link ? (
      <Link key={banner.id} to={banner.link} className="block">
        <Content />
      </Link>
    ) : (
      <div key={banner.id}>
        <Content />
      </div>
    );
  };

  // 레이아웃별 렌더링
  switch (layout) {
    case '2x1':
      // 2열 1행
      return (
        <div className="grid grid-cols-2 gap-4">
          {banners.slice(0, 2).map((banner) => renderBanner(banner, 'h-64 md:h-80'))}
        </div>
      );

    case '1x2':
      // 1열 2행
      return (
        <div className="grid grid-cols-1 gap-4 max-w-3xl mx-auto">
          {banners.slice(0, 2).map((banner) => renderBanner(banner, 'h-48 md:h-64'))}
        </div>
      );

    case '2x2':
      // 2열 2행
      return (
        <div className="grid grid-cols-2 gap-4">
          {banners.slice(0, 4).map((banner) => renderBanner(banner, 'h-48 md:h-64'))}
        </div>
      );

    case '1-2':
      // 왼쪽 큰 배너 + 오른쪽 2개 작은 배너
      return (
        <div className="grid md:grid-cols-2 gap-4">
          {banners[0] && renderBanner(banners[0], 'h-64 md:h-[528px]')}
          <div className="grid gap-4">
            {banners[1] && renderBanner(banners[1], 'h-32 md:h-64')}
            {banners[2] && renderBanner(banners[2], 'h-32 md:h-64')}
          </div>
        </div>
      );

    case '2-1':
      // 왼쪽 2개 작은 배너 + 오른쪽 큰 배너
      return (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="grid gap-4 order-2 md:order-1">
            {banners[1] && renderBanner(banners[1], 'h-32 md:h-64')}
            {banners[2] && renderBanner(banners[2], 'h-32 md:h-64')}
          </div>
          {banners[0] && renderBanner(banners[0], 'h-64 md:h-[528px] order-1 md:order-2')}
        </div>
      );

    default:
      return (
        <div className="grid grid-cols-2 gap-4">
          {banners.slice(0, 4).map((banner) => renderBanner(banner, 'h-48 md:h-64'))}
        </div>
      );
  }
}
