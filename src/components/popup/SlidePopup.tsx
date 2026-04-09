import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation, Pagination, EffectFade } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';

interface PopupImage {
  id?: string;
  image_url: string;
  link_url: string;
  caption: string;
  sort_order: number;
}

interface SlideSettings {
  autoplay: boolean;
  autoplayDelay: number;
  loop: boolean;
  navigation: boolean;
  pagination: boolean;
  effect: 'slide' | 'fade';
}

interface Props {
  images: PopupImage[];
  settings: SlideSettings;
}

export default function SlidePopup({ images, settings }: Props) {
  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Swiper
      modules={[Autoplay, Navigation, Pagination, EffectFade]}
      effect={settings.effect}
      loop={settings.loop}
      navigation={settings.navigation}
      pagination={settings.pagination ? { clickable: true } : false}
      autoplay={settings.autoplay ? { delay: settings.autoplayDelay, disableOnInteraction: false } : false}
      className="w-full"
    >
      {sorted.map((img, idx) => (
        <SwiperSlide key={img.id ?? idx}>
          {img.link_url ? (
            <a href={img.link_url} target="_blank" rel="noopener noreferrer">
              <img src={img.image_url} alt={img.caption || `슬라이드 ${idx + 1}`} className="w-full h-auto block" draggable={false} />
            </a>
          ) : (
            <img src={img.image_url} alt={img.caption || `슬라이드 ${idx + 1}`} className="w-full h-auto block" draggable={false} />
          )}
          {img.caption && (
            <p className="text-center text-xs text-gray-500 py-1 px-2">{img.caption}</p>
          )}
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
