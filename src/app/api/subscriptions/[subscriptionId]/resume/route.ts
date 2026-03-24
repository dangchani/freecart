import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

const DAY_OF_WEEK_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function getNextDayOfWeek(dayName: string): string {
  const targetDow = DAY_OF_WEEK_MAP[dayName];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const candidate = new Date(today);
  candidate.setDate(candidate.getDate() + 1); // start from tomorrow
  while (candidate.getDay() !== targetDow) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.toISOString().slice(0, 10);
}

export async function POST(
  _request: NextRequest,
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

    // Verify subscription belongs to user and is paused
    const { data: subscription, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select('id, status, delivery_day')
      .eq('id', params.subscriptionId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !subscription) {
      return NextResponse.json(
        { success: false, error: '구독 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (subscription.status !== 'paused') {
      return NextResponse.json(
        { success: false, error: '일시정지 상태의 구독만 재개할 수 있습니다.' },
        { status: 400 }
      );
    }

    // Calculate next delivery date based on delivery_day
    const nextDeliveryDate = getNextDayOfWeek(subscription.delivery_day);

    const { data: updated, error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'active',
        pause_until: null,
        next_delivery_date: nextDeliveryDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.subscriptionId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: '구독 재개 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('POST /subscriptions/[subscriptionId]/resume error:', error);
    return NextResponse.json(
      { success: false, error: '구독 재개 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
