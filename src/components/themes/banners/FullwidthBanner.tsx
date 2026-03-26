/**
 * FullwidthBanner - 풀와이드 배너
 * 화면 전체 너비 단일 배너
 */

import { Link } from 'react-router-dom';

export interface BannerItem {
  id: string;
  image: string;
  mobileImage?: string;
  title?: string;
  subtitle?: string;
  link?: string;
  buttonText?: string;
  textPosition?: 'left' | 'center' | 'right';
  textColor?: 'light' | 'dark';
}

interface Props {
  banner: BannerItem;
  height?: 'small' | 'medium' | 'large' | 'full';
}

const heightClasses = {
  small: 'h-48 md:h-64',
  medium: 'h-64 md:h-96',
  large: 'h-96 md:h-[500px]',
  full: 'h-screen',
};

const positionClasses = {
  left: 'items-start text-left',
  center: 'items-center text-center',
  right: 'items-end text-right',
};

export default function FullwidthBanner({ banner, height = 'medium' }: Props) {
  const textColor = banner.textColor === 'dark' ? 'text-gray-900' : 'text-white';
  const buttonStyle = banner.textColor === 'dark'
    ? 'bg-gray-900 text-white hover:bg-gray-800'
    : 'bg-white text-gray-900 hover:bg-gray-100';

  const Content = () => (
    <div className={`relative w-full ${heightClasses[height]}`}>
      {/* 배경 이미지 */}
      <picture>
        {banner.mobileImage && (
          <source media="(max-width: 768px)" srcSet={banner.mobileImage} />
        )}
        <img
          src={banner.image}
          alt={banner.title || ''}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </picture>

      {/* 오버레이 */}
      <div className="absolute inset-0 bg-black/20" />

      {/* 콘텐츠 */}
      {(banner.title || banner.subtitle || banner.buttonText) && (
        <div className={`absolute inset-0 flex flex-col justify-center px-8 md:px-16 ${positionClasses[banner.textPosition || 'center']}`}>
          <div className="max-w-2xl">
            {banner.subtitle && (
              <p className={`text-sm md:text-base ${textColor} opacity-80 mb-2`}>
                {banner.subtitle}
              </p>
            )}
            {banner.title && (
              <h2 className={`text-3xl md:text-5xl font-bold ${textColor} mb-4`}>
                {banner.title}
              </h2>
            )}
            {banner.buttonText && (
              <button className={`px-8 py-3 font-medium transition-colors ${buttonStyle}`}>
                {banner.buttonText}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (banner.link) {
    return (
      <Link to={banner.link} className="block">
        <Content />
      </Link>
    );
  }

  return <Content />;
}
