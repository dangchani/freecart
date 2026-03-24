import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const VALID_EVENTS = [
  'order.created',
  'order.paid',
  'order.shipped',
  'order.delivered',
  'user.registered',
  'review.created',
] as const;

type WebhookEvent = typeof VALID_EVENTS[number];

const testWebhookSchema = z.object({
  event: z.enum(VALID_EVENTS).optional(),
});

function getSamplePayload(event: WebhookEvent) {
  const timestamp = new Date().toISOString();
  const payloads: Record<WebhookEvent, object> = {
    'order.created': {
      event: 'order.created',
      timestamp,
      data: {
        id: 'ord_test_123456',
        order_number: 'ORD-2026-001',
        status: 'pending',
        total_amount: 59000,
        user: { id: 'usr_test_001', email: 'test@example.com', name: '홍길동' },
        items: [
          { product_id: 'prd_001', name: '테스트 상품', quantity: 1, price: 59000 },
        ],
        created_at: timestamp,
      },
    },
    'order.paid': {
      event: 'order.paid',
      timestamp,
      data: {
        id: 'ord_test_123456',
        order_number: 'ORD-2026-001',
        status: 'paid',
        total_amount: 59000,
        payment_method: 'card',
        paid_at: timestamp,
      },
    },
    'order.shipped': {
      event: 'order.shipped',
      timestamp,
      data: {
        id: 'ord_test_123456',
        order_number: 'ORD-2026-001',
        status: 'shipped',
        tracking_number: '123456789012',
        carrier: 'CJ대한통운',
        shipped_at: timestamp,
      },
    },
    'order.delivered': {
      event: 'order.delivered',
      timestamp,
      data: {
        id: 'ord_test_123456',
        order_number: 'ORD-2026-001',
        status: 'delivered',
        delivered_at: timestamp,
      },
    },
    'user.registered': {
      event: 'user.registered',
      timestamp,
      data: {
        id: 'usr_test_001',
        email: 'test@example.com',
        name: '홍길동',
        registered_at: timestamp,
      },
    },
    'review.created': {
      event: 'review.created',
      timestamp,
      data: {
        id: 'rev_test_001',
        product_id: 'prd_001',
        product_name: '테스트 상품',
        user: { id: 'usr_test_001', name: '홍길동' },
        rating: 5,
        content: '테스트 리뷰입니다.',
        created_at: timestamp,
      },
    },
  };

  return payloads[event];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { event: testEvent } = testWebhookSchema.parse(body);

    // Get webhook config
    const { data: webhook, error: webhookError } = await supabase
      .from('webhook_configs')
      .select('*')
      .eq('id', id)
      .single();

    if (webhookError || !webhook) {
      return NextResponse.json({ success: false, error: '웹훅을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (!webhook.is_active) {
      return NextResponse.json(
        { success: false, error: '비활성화된 웹훅입니다.' },
        { status: 400 }
      );
    }

    // Use specified event or first configured event
    const eventToTest: WebhookEvent = testEvent || webhook.events[0];
    const payload = getSamplePayload(eventToTest);
    const payloadString = JSON.stringify(payload);

    // Build request headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Freecart-Event': eventToTest,
      'X-Freecart-Delivery': globalThis.crypto.randomUUID(),
      'X-Freecart-Test': 'true',
    };

    // Sign payload if secret is configured
    if (webhook.secret) {
      const enc = new TextEncoder();
      const key = await globalThis.crypto.subtle.importKey(
        'raw', enc.encode(webhook.secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign']
      );
      const sigBuffer = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(payloadString));
      const signature = Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      headers['X-Freecart-Signature'] = `sha256=${signature}`;
    }

    // Send test webhook
    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let deliveryError: string | null = null;

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(10000),
      });

      responseStatus = response.status;
      responseBody = await response.text().catch(() => null);
    } catch (fetchError) {
      deliveryError = fetchError instanceof Error ? fetchError.message : '전송 실패';
    }

    const success = responseStatus !== null && responseStatus >= 200 && responseStatus < 300;

    return NextResponse.json({
      success: true,
      data: {
        delivered: success,
        event: eventToTest,
        url: webhook.url,
        response_status: responseStatus,
        response_body: responseBody,
        error: deliveryError,
        payload,
      },
      message: success ? '테스트 웹훅이 성공적으로 전송되었습니다.' : '테스트 웹훅 전송에 실패했습니다.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: '테스트 웹훅 전송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
