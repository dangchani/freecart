import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: { orderNumber: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Fetch order and validate ownership
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, status, user_id, total')
      .eq('order_number', params.orderNumber)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (order.status !== 'delivered' && order.status !== 'shipping') {
      return NextResponse.json(
        { success: false, error: '배송 중이거나 배송 완료된 주문만 구매 확정이 가능합니다.' },
        { status: 400 }
      );
    }

    // Update order status to confirmed
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: '구매 확정 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    // Calculate earned points (1% of total, rounded to integer)
    const earnedPoints = Math.round(order.total * 0.01);

    if (earnedPoints > 0) {
      // Fetch current points balance
      const { data: userData } = await supabase
        .from('users')
        .select('points')
        .eq('id', user.id)
        .single();

      const currentPoints = userData?.points ?? 0;
      const newPoints = currentPoints + earnedPoints;

      // Insert into user_points_history
      await supabase.from('user_points_history').insert({
        user_id: user.id,
        order_id: order.id,
        type: 'earn_purchase',
        amount: earnedPoints,
        balance_after: newPoints,
        description: `구매 확정 적립 (주문번호: ${params.orderNumber})`,
      });

      // Update user points
      await supabase
        .from('users')
        .update({ points: newPoints, updated_at: new Date().toISOString() })
        .eq('id', user.id);
    }

    return NextResponse.json({
      success: true,
      data: {
        order: updatedOrder,
        earnedPoints,
      },
    });
  } catch (error) {
    console.error('POST /orders/[orderNumber]/confirm error:', error);
    return NextResponse.json(
      { success: false, error: '구매 확정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
