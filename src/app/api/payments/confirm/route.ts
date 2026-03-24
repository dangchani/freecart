import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const confirmPaymentSchema = z.object({
  paymentKey: z.string(),
  orderId: z.string(),
  amount: z.number().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const paymentData = confirmPaymentSchema.parse(body);

    // Call Toss Payments confirmation API
    const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.TOSS_PAYMENTS_SECRET_KEY}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey: paymentData.paymentKey, orderId: paymentData.orderId, amount: paymentData.amount }),
    });

    if (!tossResponse.ok) {
      const tossError = await tossResponse.json();
      return NextResponse.json({ success: false, error: tossError.message || '결제 확인 실패' }, { status: 400 });
    }

    const tossData = await tossResponse.json();

    // 주문 상태 업데이트
    const { data: order, error } = await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        status: 'processing',
        payment_key: tossData.paymentKey,
        payment_method: tossData.method,
        paid_at: tossData.approvedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('order_number', paymentData.orderId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '결제 승인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
