import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AVAILABLE_THEMES = [
  {
    id: 'theme-default',
    slug: 'default',
    name: '기본 테마',
    version: '1.0.0',
    description: 'Freecart 기본 테마입니다.',
    preview_url: 'https://freecart-web.vercel.app/themes/default/preview',
    thumbnail_url: 'https://freecart-web.vercel.app/themes/default/thumbnail.png',
    author: 'Freecart',
    price: 0,
    is_free: true,
    tags: ['default', 'clean', 'minimal'],
  },
  {
    id: 'theme-modern',
    slug: 'modern',
    name: '모던 테마',
    version: '1.2.0',
    description: '깔끔하고 현대적인 디자인의 테마입니다.',
    preview_url: 'https://freecart-web.vercel.app/themes/modern/preview',
    thumbnail_url: 'https://freecart-web.vercel.app/themes/modern/thumbnail.png',
    author: 'Freecart',
    price: 0,
    is_free: true,
    tags: ['modern', 'clean'],
  },
  {
    id: 'theme-luxury',
    slug: 'luxury',
    name: '럭셔리 테마',
    version: '2.0.1',
    description: '고급스러운 느낌의 프리미엄 테마입니다.',
    preview_url: 'https://freecart-web.vercel.app/themes/luxury/preview',
    thumbnail_url: 'https://freecart-web.vercel.app/themes/luxury/thumbnail.png',
    author: 'Freecart',
    price: 99000,
    is_free: false,
    tags: ['luxury', 'premium', 'dark'],
  },
  {
    id: 'theme-minimal',
    slug: 'minimal',
    name: '미니멀 테마',
    version: '1.1.0',
    description: '심플하고 미니멀한 디자인 테마입니다.',
    preview_url: 'https://freecart-web.vercel.app/themes/minimal/preview',
    thumbnail_url: 'https://freecart-web.vercel.app/themes/minimal/thumbnail.png',
    author: 'Freecart',
    price: 49000,
    is_free: false,
    tags: ['minimal', 'simple'],
  },
];

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    // Get installed themes to mark which ones are already installed
    const { data: installedThemes } = await supabase
      .from('installed_themes')
      .select('slug');

    const installedSlugs = new Set((installedThemes || []).map((t) => t.slug));

    const themesWithStatus = AVAILABLE_THEMES.map((theme) => ({
      ...theme,
      is_installed: installedSlugs.has(theme.slug),
    }));

    return NextResponse.json({ success: true, data: themesWithStatus });
  } catch {
    return NextResponse.json(
      { success: false, error: '사용 가능한 테마 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
