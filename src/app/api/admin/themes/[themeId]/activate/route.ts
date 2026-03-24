import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function POST(
  _request: NextRequest,
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

    // Verify the target theme exists and is installed
    const { data: targetTheme, error: themeError } = await supabase
      .from('installed_themes')
      .select('id, name, slug')
      .eq('id', themeId)
      .single();

    if (themeError || !targetTheme) {
      return NextResponse.json({ success: false, error: '설치된 테마를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Deactivate all themes
    const { error: deactivateError } = await supabase
      .from('installed_themes')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .neq('id', themeId);

    if (deactivateError) {
      return NextResponse.json({ success: false, error: deactivateError.message }, { status: 400 });
    }

    // Activate the target theme
    const { data, error: activateError } = await supabase
      .from('installed_themes')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', themeId)
      .select()
      .single();

    if (activateError) {
      return NextResponse.json({ success: false, error: activateError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: `${targetTheme.name} 테마가 활성화되었습니다.`,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '테마 활성화 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
