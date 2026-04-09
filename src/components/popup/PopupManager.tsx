import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import PopupContainer from './PopupContainer';

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

function getTodayKey(id: string) {
  return `popup_closed_${id}_${format(new Date(), 'yyyy-MM-dd')}`;
}

function isDismissedToday(id: string) {
  return localStorage.getItem(getTodayKey(id)) === '1';
}

export default function PopupManager() {
  const [popups, setPopups] = useState<PopupData[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const now = new Date().toISOString();

    supabase
      .from('popups')
      .select('*, popup_images(id, image_url, link_url, caption, sort_order)')
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (error) { console.error('[PopupManager]', error); return; }
        if (!data) return;
        const visible = data
          .filter((p) => !isDismissedToday(p.id))
          .map((p) => ({
            id: p.id,
            name: p.name,
            popup_type: p.popup_type as PopupType,
            content: p.content ?? '',
            image_url: p.image_url ?? '',
            link_url: p.link_url ?? '',
            slide_settings: p.slide_settings as SlideSettings | null,
            images: (p.popup_images ?? []) as PopupImage[],
            position: p.position as PositionPreset,
            position_x: p.position_x ?? null,
            position_y: p.position_y ?? null,
            width: p.width ?? 400,
            show_today_close: p.show_today_close ?? false,
          }));
        setPopups(visible);
      });
  }, []);

  function handleClose(id: string, todayClose: boolean) {
    if (todayClose) {
      localStorage.setItem(getTodayKey(id), '1');
    }
    setPopups((prev) => prev.filter((p) => p.id !== id));
  }

  if (popups.length === 0) return null;

  return (
    <>
      {popups.map((popup) => (
        <PopupContainer key={popup.id} popup={popup} onClose={handleClose} />
      ))}
    </>
  );
}
