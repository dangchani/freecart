/**
 * SliderBanner - 슬라이더 배너
 * 자동 재생되는 배너 슬라이드
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { BannerItem } from './FullwidthBanner';

interface Props {
  banners: BannerItem[];
  height?: 'small' | 'medium' | 'large' | 'full';
  autoPlay?: boolean;
  interval?: number;
  showArrows?: boolean;
  showDots?: boolean;
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

export default function SliderBanner({
  banners,
  height = 'large',
  autoPlay = true,
  interval = 5000,
  showArrows = true,
  showDots = true,
}: Props) {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const prev = () => {
    setCurrent((prev) => (prev - 1 + banners.length) % banners.length);
  };

  // 자동 재생
  useEffect(() => {
    if (!autoPlay || banners.length <= 1) return;

    const timer = setInterval(next, interval);
    return () => clearInterval(timer);
  }, [autoPlay, interval, next, banners.length]);

  if (banners.length === 0) return null;

  return (
    <div className={`relative overflow-hidden ${heightClasses[height]}`}>
      {/* 슬라이드 */}
      <div
        className="flex transition-transform duration-500 h-full"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {banners.map((banner) => {
          const textColor = banner.textColor === 'dark' ? 'text-gray-900' : 'text-white';
          const buttonStyle = banner.textColor === 'dark'
            ? 'bg-gray-900 text-white hover:bg-gray-800'
            : 'bg-white text-gray-900 hover:bg-gray-100';

          const Slide = () => (
            <div className="relative w-full h-full flex-shrink-0">
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

              <div className="absolute inset-0 bg-black/20" />

              {(banner.title || banner.subtitle || banner.buttonText) && (
                <div className={`absolute inset-0 flex flex-col justify-center px-8 md:px-16 ${positionClasses[banner.textPosition || 'center']}`}>
                  <div className="max-w-2xl">
                    {banner.subtitle && (
                      <p className={`text-sm md:text-base ${textColor} opacity-80 mb-2 animate-fade-in`}>
                        {banner.subtitle}
                      </p>
                    )}
                    {banner.title && (
                      <h2 className={`text-3xl md:text-5xl font-bold ${textColor} mb-4 animate-slide-up`}>
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

          return banner.link ? (
            <Link key={banner.id} to={banner.link} className="block w-full h-full flex-shrink-0">
              <Slide />
            </Link>
          ) : (
            <div key={banner.id} className="w-full h-full flex-shrink-0">
              <Slide />
            </div>
          );
        })}
      </div>

      {/* 화살표 */}
      {showArrows && banners.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 hover:bg-white rounded-full flex items-center justify-center text-gray-800 transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/80 hover:bg-white rounded-full flex items-center justify-center text-gray-800 transition-colors"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* 인디케이터 */}
      {showDots && banners.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrent(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === current ? 'w-6 bg-white' : 'bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
