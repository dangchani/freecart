import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const exchangeSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1, '교환할 상품을 선택해 주세요.'),
  reason: z.string().min(1, '교환 사유를 입력해 주세요.'),
  exchangeVariantId: z.string().uuid('교환할 옵션을 선택해 주세요.'),
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
    const { itemIds, reason, exchangeVariantId } = exchangeSchema.parse(body);

    const isUUID = UUID_REGEX.test(params.orderId);
    const query = supabase.from('orders').select('id, status, user_id').eq('user_id', user.id);
    const { data: order, error: fetchError } = await (isUUID
      ? query.eq('id', params.orderId)
      : query.eq('order_number', params.orderId)
    ).single();

    if (fetchError || !order) {
      return NextResponse.json({ success: false, error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (order.status !== 'delivered') {
      return NextResponse.json(
        { success: false, error: '배송 완료된 주문만 교환 신청이 가능합니다.' },
        { status: 400 }
      );
    }

    const { data: existingExchange } = await supabase
      .from('exchanges')
      .select('id')
      .eq('order_id', order.id)
      .single();

    if (existingExchange) {
      return NextResponse.json(
        { success: false, error: '이미 교환 신청이 접수된 주문입니다.' },
        { status: 400 }
      );
    }

    const { data: variant } = await supabase
      .from('product_variants')
      .select('id, stock_quantity')
      .eq('id', exchangeVariantId)
      .single();

    if (!variant) {
      return NextResponse.json({ success: false, error: '교환할 상품 옵션을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (variant.stock_quantity !== null && variant.stock_quantity <= 0) {
      return NextResponse.json({ success: false, error: '선택한 옵션의 재고가 없습니다.' }, { status: 400 });
    }

    const { data: exchangeRequest, error: insertError } = await supabase
      .from('exchanges')
      .insert({
        order_id: order.id,
        user_id: user.id,
        item_ids: itemIds,
        reason,
        exchange_variant_id: exchangeVariantId,
        status: 'requested',
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ success: false, error: '교환 신청 중 오류가 발생했습니다.' }, { status: 400 });
    }

    await supabase
      .from('orders')
      .update({ status: 'exchange_requested', updated_at: new Date().toISOString() })
      .eq('id', order.id);

    return NextResponse.json({ success: true, data: exchangeRequest }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message ?? '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: false, error: '교환 신청 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
