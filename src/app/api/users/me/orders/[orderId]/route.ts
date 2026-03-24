import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(
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

    const { orderId } = params;

    const { data, error } = await supabase
      .from('orders')
      .select(
        `
        id,
        order_number,
        status,
        payment_status,
        subtotal,
        shipping_cost,
        discount,
        total,
        shipping_name,
        shipping_address,
        shipping_phone,
        payment_method,
        memo,
        tracking_number,
        shipped_at,
        delivered_at,
        cancelled_at,
        created_at,
        updated_at,
        items:order_items(
          id,
          product_id,
          product_name,
          price,
          quantity,
          options,
          product:products(
            id,
            name,
            slug,
            primary_image
          )
        )
      `
      )
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('GET /users/me/orders/[orderId] error:', error);
    return NextResponse.json(
      { success: false, error: '주문 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
