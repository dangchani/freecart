import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const installThemeSchema = z.object({
  licenseKey: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ themeId: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { themeId } = await params;
    const body = await request.json();
    const { licenseKey } = installThemeSchema.parse(body);

    // Validate license key with freecart-web marketplace
    let themeInfo: { slug: string; name: string; version: string } | null = null;
    try {
      const licenseResponse = await fetch(
        `${process.env.FREECART_WEB_API_URL || 'https://freecart-web.vercel.app'}/api/licenses/validate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ licenseKey, themeId }),
        }
      );

      if (licenseResponse.ok) {
        const licenseData = await licenseResponse.json();
        themeInfo = licenseData.theme;
      } else {
        // If external validation fails (e.g., network error), use local fallback for free themes
        const freeThemes: Record<string, { slug: string; name: string; version: string }> = {
          'theme-default': { slug: 'default', name: '기본 테마', version: '1.0.0' },
          'theme-modern': { slug: 'modern', name: '모던 테마', version: '1.2.0' },
        };

        if (licenseKey === 'FREE' && freeThemes[themeId]) {
          themeInfo = freeThemes[themeId];
        } else {
          return NextResponse.json(
            { success: false, error: '유효하지 않은 라이선스 키입니다.' },
            { status: 400 }
          );
        }
      }
    } catch {
      // Fallback for free themes when external API is unavailable
      const freeThemes: Record<string, { slug: string; name: string; version: string }> = {
        'theme-default': { slug: 'default', name: '기본 테마', version: '1.0.0' },
        'theme-modern': { slug: 'modern', name: '모던 테마', version: '1.2.0' },
      };

      if (licenseKey === 'FREE' && freeThemes[themeId]) {
        themeInfo = freeThemes[themeId];
      } else {
        return NextResponse.json(
          { success: false, error: '라이선스 검증 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
          { status: 503 }
        );
      }
    }

    if (!themeInfo) {
      return NextResponse.json({ success: false, error: '테마 정보를 가져올 수 없습니다.' }, { status: 400 });
    }

    // Check if theme is already installed
    const { data: existingTheme } = await supabase
      .from('installed_themes')
      .select('id')
      .eq('slug', themeInfo.slug)
      .single();

    if (existingTheme) {
      return NextResponse.json(
        { success: false, error: '이미 설치된 테마입니다.' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('installed_themes')
      .insert({
        slug: themeInfo.slug,
        name: themeInfo.name,
        version: themeInfo.version,
        is_active: false,
        installed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { success: true, data, message: `${themeInfo.name} 테마가 성공적으로 설치되었습니다.` },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: '테마 설치 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
