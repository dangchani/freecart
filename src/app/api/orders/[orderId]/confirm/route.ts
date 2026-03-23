import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const isUUID = UUID_REGEX.test(params.orderId);
    const query = supabase.from('orders').select('id, order_number, status, user_id, total').eq('user_id', user.id);
    const { data: order, error: fetchError } = await (isUUID
      ? query.eq('id', params.orderId)
      : query.eq('order_number', params.orderId)
    ).single();

    if (fetchError || !order) {
      return NextResponse.json({ success: false, error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (order.status !== 'delivered' && order.status !== 'shipping') {
      return NextResponse.json(
        { success: false, error: '배송 중이거나 배송 완료된 주문만 구매 확정이 가능합니다.' },
        { status: 400 }
      );
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: '구매 확정 중 오류가 발생했습니다.' }, { status: 400 });
    }

    const earnedPoints = Math.round(order.total * 0.01);

    if (earnedPoints > 0) {
      const { data: userData } = await supabase.from('users').select('points').eq('id', user.id).single();
      const currentPoints = userData?.points ?? 0;
      const newPoints = currentPoints + earnedPoints;

      await supabase.from('user_points_history').insert({
        user_id: user.id,
        order_id: order.id,
        type: 'earn_purchase',
        amount: earnedPoints,
        balance_after: newPoints,
        description: `구매 확정 적립 (주문번호: ${order.order_number})`,
      });

      await supabase
        .from('users')
        .update({ points: newPoints, updated_at: new Date().toISOString() })
        .eq('id', user.id);
    }

    return NextResponse.json({ success: true, data: { order: updatedOrder, earnedPoints } });
  } catch (error) {
    return NextResponse.json({ success: false, error: '구매 확정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
