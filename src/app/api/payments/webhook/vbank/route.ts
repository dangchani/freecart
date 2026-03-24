import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

async function verifyTossWebhookSignature(
  rawBody: string,
  signature: string,
  secretKey: string
): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      'raw', enc.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    );
    const signatureBuffer = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
    const digest = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    return digest === signature;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const webhookSignature = request.headers.get('toss-signature') ?? '';
    const webhookSecret = process.env.TOSS_WEBHOOK_SECRET ?? '';

    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const isValid = await verifyTossWebhookSignature(rawBody, webhookSignature, webhookSecret);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: '유효하지 않은 웹훅 서명입니다.' },
          { status: 401 }
        );
      }
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 요청 본문입니다.' },
        { status: 400 }
      );
    }

    const eventType = payload.eventType as string;

    // Handle only virtual account deposit events
    if (eventType !== 'DEPOSIT_CALLBACK') {
      return NextResponse.json({ success: true, data: { received: true } });
    }

    const data = payload.data as Record<string, unknown>;
    const paymentKey = data?.paymentKey as string;
    const orderId = data?.orderId as string;  // This is the order_number
    const status = data?.status as string;

    if (!paymentKey || !orderId) {
      return NextResponse.json(
        { success: false, error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Find the order by order_number
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, order_number, payment_status, status, total')
      .eq('order_number', orderId)
      .single();

    if (fetchError || !order) {
      console.error('VBank webhook: order not found', orderId);
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Only process if not already paid
    if (order.payment_status === 'paid') {
      return NextResponse.json({ success: true, data: { message: '이미 처리된 결제입니다.' } });
    }

    if (status === 'DONE') {
      // Update order payment status
      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      // Update or insert payment record
      const { data: existingPayment } = await supabase
        .from('order_payments')
        .select('id')
        .eq('order_id', order.id)
        .single();

      if (existingPayment) {
        await supabase
          .from('order_payments')
          .update({
            payment_key: paymentKey,
            status: 'paid',
            paid_at: new Date().toISOString(),
            raw_data: payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPayment.id);
      } else {
        await supabase.from('order_payments').insert({
          order_id: order.id,
          payment_key: paymentKey,
          payment_method: 'vbank',
          amount: order.total,
          status: 'paid',
          paid_at: new Date().toISOString(),
          raw_data: payload,
        });
      }
    } else if (status === 'CANCELED' || status === 'EXPIRED') {
      await supabase
        .from('orders')
        .update({
          payment_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);
    }

    return NextResponse.json({ success: true, data: { received: true } });
  } catch (error) {
    console.error('POST /payments/webhook/vbank error:', error);
    return NextResponse.json(
      { success: false, error: '웹훅 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
