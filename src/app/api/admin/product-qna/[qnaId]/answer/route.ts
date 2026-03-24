import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const answerSchema = z.object({
  answer: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ qnaId: string }> }
) {
  try {
    const supabase = await createClient();
    const { qnaId } = await params;

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
    const { answer } = answerSchema.parse(body);

    const { data, error } = await supabase
      .from('product_qna')
      .update({
        answer,
        answered_at: new Date().toISOString(),
        answered_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', qnaId)
      .select()
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
      { success: false, error: '답변을 등록하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
