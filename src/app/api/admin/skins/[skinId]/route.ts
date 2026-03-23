import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateSkinSchema = z.object({
  settings: z.record(z.unknown()),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ skinId: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { skinId } = await params;

    const { data, error } = await supabase
      .from('skins')
      .select('*')
      .eq('id', skinId)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: '스킨을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, error: '스킨 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ skinId: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { skinId } = await params;
    const body = await request.json();
    const { settings } = updateSkinSchema.parse(body);

    const { data, error } = await supabase
      .from('skins')
      .update({ settings })
      .eq('id', skinId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ success: false, error: '스킨을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: '스킨 설정 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ skinId: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { skinId } = await params;

    // Verify skin exists and is not a system skin
    const { data: skin, error: skinError } = await supabase
      .from('skins')
      .select('id, name, is_system, is_active')
      .eq('id', skinId)
      .single();

    if (skinError || !skin) {
      return NextResponse.json({ success: false, error: '스킨을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (skin.is_system) {
      return NextResponse.json(
        { success: false, error: '시스템 스킨은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    if (skin.is_active) {
      return NextResponse.json(
        { success: false, error: '현재 활성화된 스킨은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('skins')
      .delete()
      .eq('id', skinId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `${skin.name} 스킨이 삭제되었습니다.` });
  } catch {
    return NextResponse.json(
      { success: false, error: '스킨 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
