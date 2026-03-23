import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const cancelSchema = z.object({
  reason: z.string().min(1),
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
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

    const body = await request.json();
    const { reason } = cancelSchema.parse(body);

    const isUUID = UUID_REGEX.test(params.orderId);
    const query = supabase.from('orders').select('*').eq('user_id', user.id);
    const { data: order, error: fetchError } = await (isUUID
      ? query.eq('id', params.orderId)
      : query.eq('order_number', params.orderId)
    ).single();

    if (fetchError || !order) {
      return NextResponse.json({ success: false, error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (order.status === 'cancelled') {
      return NextResponse.json({ success: false, error: '이미 취소된 주문입니다.' }, { status: 400 });
    }

    if (order.status === 'shipped' || order.status === 'delivered') {
      return NextResponse.json(
        { success: false, error: '배송 중이거나 완료된 주문은 취소할 수 없습니다.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ status: 'cancelled', memo: reason, updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: '입력값이 올바르지 않습니다.' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: '주문 취소 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
