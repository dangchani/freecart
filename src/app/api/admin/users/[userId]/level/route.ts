import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const changeLevelSchema = z.object({
  levelId: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const supabase = await createClient();
    const { userId } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: adminProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { levelId } = changeLevelSchema.parse(body);

    const { data: level } = await supabase
      .from('user_levels')
      .select('id, name')
      .eq('id', levelId)
      .single();

    if (!level) {
      return NextResponse.json({ success: false, error: '등급을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ level_id: levelId, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('*, user_levels(id, name, discount_rate)')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: '등급을 변경하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
