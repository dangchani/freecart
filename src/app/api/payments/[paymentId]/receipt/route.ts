import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Fetch payment with order info to verify ownership
    const { data: payment, error: fetchError } = await supabase
      .from('order_payments')
      .select(`
        id,
        order_id,
        payment_key,
        payment_method,
        amount,
        status,
        raw_data,
        paid_at,
        created_at,
        order:orders(
          id,
          order_number,
          user_id,
          total,
          status,
          shipping_name,
          shipping_address
        )
      `)
      .eq('id', params.paymentId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json(
        { success: false, error: '결제 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Verify the order belongs to the current user
    const order = payment.order as { user_id?: string; order_number?: string } | null;
    if (!order || order.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    if (payment.status !== 'paid') {
      return NextResponse.json(
        { success: false, error: '결제가 완료된 주문의 영수증만 조회 가능합니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: payment });
  } catch (error) {
    console.error('GET /payments/[paymentId]/receipt error:', error);
    return NextResponse.json(
      { success: false, error: '영수증 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
