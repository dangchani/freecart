import { X } from 'lucide-react';
import TextPopup from './TextPopup';
import ImagePopup from './ImagePopup';
import SlidePopup from './SlidePopup';

type PopupType = 'text' | 'image' | 'slide';
type PositionPreset = 'center' | 'top' | 'bottom' | 'left' | 'right' | 'custom';

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

interface PopupData {
  id: string;
  name: string;
  popup_type: PopupType;
  content: string;
  image_url: string;
  link_url: string;
  slide_settings: SlideSettings | null;
  images: PopupImage[];
  position: PositionPreset;
  position_x: number | null;
  position_y: number | null;
  width: number;
  show_today_close: boolean;
}

interface Props {
  popup: PopupData;
  onClose: (id: string, todayClose: boolean) => void;
}

function getPositionStyle(position: PositionPreset, x: number | null, y: number | null): React.CSSProperties {
  if (position === 'custom' && x != null && y != null) {
    return {
      position: 'fixed',
      left: `${x}%`,
      top: `${y}%`,
      transform: 'translate(-50%, -50%)',
      zIndex: 9999,
    };
  }
  const base: React.CSSProperties = { position: 'fixed', zIndex: 9999 };
  switch (position) {
    case 'top':    return { ...base, top: '16px', left: '50%', transform: 'translateX(-50%)' };
    case 'bottom': return { ...base, bottom: '16px', left: '50%', transform: 'translateX(-50%)' };
    case 'left':   return { ...base, top: '50%', left: '16px', transform: 'translateY(-50%)' };
    case 'right':  return { ...base, top: '50%', right: '16px', transform: 'translateY(-50%)' };
    default:       return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
}

export default function PopupContainer({ popup, onClose }: Props) {
  const positionStyle = getPositionStyle(popup.position, popup.position_x, popup.position_y);

  return (
    <div
      style={{ ...positionStyle, width: popup.width ? `${popup.width}px` : '400px', maxWidth: '90vw' }}
      className="bg-white rounded-lg shadow-2xl overflow-hidden"
    >
      {/* 닫기 버튼 */}
      <div className="flex justify-end items-center px-3 py-1.5 bg-gray-50 border-b">
        <button
          onClick={() => onClose(popup.id, false)}
          className="p-1 hover:bg-gray-200 rounded-full transition-colors"
          aria-label="닫기"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* 팝업 콘텐츠 */}
      <div>
        {popup.popup_type === 'text' && <TextPopup content={popup.content} />}
        {popup.popup_type === 'image' && <ImagePopup imageUrl={popup.image_url} linkUrl={popup.link_url} />}
        {popup.popup_type === 'slide' && (
          <SlidePopup
            images={popup.images}
            settings={popup.slide_settings ?? {
              autoplay: true, autoplayDelay: 3000,
              loop: true, navigation: true, pagination: true, effect: 'slide',
            }}
          />
        )}
      </div>

      {/* 오늘 하루 보지 않기 */}
      {popup.show_today_close && (
        <div className="px-3 py-2 border-t bg-gray-50 flex justify-between items-center">
          <button
            onClick={() => onClose(popup.id, true)}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            오늘 하루 보지 않기
          </button>
        </div>
      )}
    </div>
  );
}
