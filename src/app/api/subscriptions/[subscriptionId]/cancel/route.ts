import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const cancelSchema = z.object({
  reason: z.string().min(1, '취소 사유를 입력해 주세요.'),
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
    const { reason } = cancelSchema.parse(body);

    // Verify subscription belongs to user
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

    if (subscription.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: '이미 취소된 구독입니다.' },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'cancelled',
        cancel_reason: reason,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.subscriptionId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: '구독 취소 중 오류가 발생했습니다.' },
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
    console.error('POST /subscriptions/[subscriptionId]/cancel error:', error);
    return NextResponse.json(
      { success: false, error: '구독 취소 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
