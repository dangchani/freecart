import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function DELETE(
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

    // Check theme exists
    const { data: theme, error: themeError } = await supabase
      .from('installed_themes')
      .select('id, name, is_active')
      .eq('id', themeId)
      .single();

    if (themeError || !theme) {
      return NextResponse.json({ success: false, error: '설치된 테마를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Prevent uninstalling the currently active theme
    if (theme.is_active) {
      return NextResponse.json(
        { success: false, error: '현재 활성화된 테마는 삭제할 수 없습니다. 다른 테마를 먼저 활성화하세요.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('installed_themes')
      .delete()
      .eq('id', themeId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `${theme.name} 테마가 삭제되었습니다.`,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '테마 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
