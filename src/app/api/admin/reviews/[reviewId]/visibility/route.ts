import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const visibilitySchema = z.object({
  isVisible: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const supabase = await createClient();
    const { reviewId } = await params;

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
    const { isVisible } = visibilitySchema.parse(body);

    const { data, error } = await supabase
      .from('reviews')
      .update({ is_visible: isVisible, updated_at: new Date().toISOString() })
      .eq('id', reviewId)
      .select('id, is_visible')
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
      { success: false, error: '리뷰 공개 여부를 변경하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
