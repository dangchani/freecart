import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const pauseSchema = z.object({
  pauseUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { subscriptionId: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { pauseUntil } = pauseSchema.parse(body);

    // Validate pauseUntil is in the future
    const pauseDate = new Date(pauseUntil);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (pauseDate <= today) {
      return NextResponse.json(
        { success: false, error: '일시정지 종료일은 오늘 이후 날짜여야 합니다.' },
        { status: 400 }
      );
    }

    // Verify subscription belongs to user and is active
    const { data: subscription, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select('id, status')
      .eq('id', params.subscriptionId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !subscription) {
      return NextResponse.json(
        { success: false, error: '구독 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (subscription.status !== 'active') {
      return NextResponse.json(
        { success: false, error: '활성 상태의 구독만 일시정지할 수 있습니다.' },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'paused',
        pause_until: pauseUntil,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.subscriptionId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: '구독 일시정지 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message ?? '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    console.error('POST /subscriptions/[subscriptionId]/pause error:', error);
    return NextResponse.json(
      { success: false, error: '구독 일시정지 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
