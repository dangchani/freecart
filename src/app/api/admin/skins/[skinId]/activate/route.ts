import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const toggleSchema = z.object({
  is_active: z.boolean().optional(),
});

export async function POST(
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

    const { data: skin, error: skinError } = await supabase
      .from('skins')
      .select('id, name, type')
      .eq('id', skinId)
      .single();

    if (skinError || !skin) {
      return NextResponse.json({ success: false, error: '스킨을 찾을 수 없습니다.' }, { status: 404 });
    }

    // Deactivate other skins of the same type
    await supabase
      .from('skins')
      .update({ is_active: false })
      .eq('type', skin.type)
      .neq('id', skinId);

    // Activate this skin
    const { data, error } = await supabase
      .from('skins')
      .update({ is_active: true })
      .eq('id', skinId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data,
      message: `${skin.name} 스킨이 활성화되었습니다.`,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '스킨 활성화 중 오류가 발생했습니다.' },
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
    const { is_active } = toggleSchema.parse(body);

    const { data: skin, error: skinError } = await supabase
      .from('skins')
      .select('id, name, type')
      .eq('id', skinId)
      .single();

    if (skinError || !skin) {
      return NextResponse.json({ success: false, error: '스킨을 찾을 수 없습니다.' }, { status: 404 });
    }

    // If activating, deactivate other skins of the same type
    if (is_active === true || is_active === undefined) {
      await supabase
        .from('skins')
        .update({ is_active: false })
        .eq('type', skin.type)
        .neq('id', skinId);
    }

    const { data, error } = await supabase
      .from('skins')
      .update({ is_active: is_active !== undefined ? is_active : true })
      .eq('id', skinId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    const statusText = data.is_active ? '활성화' : '비활성화';

    return NextResponse.json({
      success: true,
      data,
      message: `${skin.name} 스킨이 ${statusText}되었습니다.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: '스킨 상태 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
