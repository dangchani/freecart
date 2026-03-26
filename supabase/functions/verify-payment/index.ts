import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { paymentKey, orderId, amount } = await req.json();

    if (!paymentKey || !orderId || !amount) {
      return errorResponse('필수 파라미터가 누락되었습니다.', 400);
    }

    // Supabase Admin 클라이언트 (service_role key 사용)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. 주문 정보 조회 (DB에 저장된 실제 금액)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, status')
      .eq('order_number', orderId)
      .single();

    if (orderError || !order) {
      return errorResponse('주문을 찾을 수 없습니다.', 404);
    }

    if (order.status === 'paid') {
      return errorResponse('이미 결제된 주문입니다.', 400);
    }

    // 2. 금액 위변조 검증 (DB 금액 vs 전달받은 금액)
    const requestedAmount = parseInt(amount);
    if (order.total_amount !== requestedAmount) {
      console.error(`금액 불일치: DB=${order.total_amount}, 요청=${requestedAmount}, orderId=${orderId}`);
      return errorResponse('결제 금액이 주문 금액과 일치하지 않습니다.', 400);
    }

    // 3. 활성 PG 조회
    const { data: pgData, error: pgError } = await supabase
      .from('payment_gateways')
      .select('provider, name, secret_key, settings')
      .eq('is_active', true)
      .single();

    if (pgError || !pgData) {
      return errorResponse('활성화된 PG사가 없습니다.', 500);
    }

    // 4. PG사별 결제 검증
    let pgResult: { success: boolean; data?: any; error?: string };

    switch (pgData.provider) {
      case 'toss':
        pgResult = await verifyToss(paymentKey, orderId, requestedAmount, pgData.secret_key);
        break;
      case 'inicis':
        pgResult = await verifyInicis(paymentKey, orderId, requestedAmount, pgData.secret_key, pgData.settings);
        break;
      case 'kiwoom':
        pgResult = await verifyKiwoom(paymentKey, orderId, requestedAmount, pgData.secret_key, pgData.settings);
        break;
      case 'kcp':
        pgResult = await verifyKcp(paymentKey, orderId, requestedAmount, pgData.secret_key, pgData.settings);
        break;
      case 'nicepay':
        pgResult = await verifyNicepay(paymentKey, orderId, requestedAmount, pgData.secret_key, pgData.settings);
        break;
      default:
        return errorResponse(`지원하지 않는 PG사입니다: ${pgData.provider}`, 400);
    }

    if (!pgResult.success) {
      return errorResponse(pgResult.error || 'PG 결제 검증 실패', 400);
    }

    // 5. 결제 성공 처리 - orders 테이블 업데이트
    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        payment_method: pgData.name,
        pg_provider: pgData.provider,
        paid_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateOrderError) {
      console.error('Order update failed:', updateOrderError);
      return errorResponse('주문 상태 업데이트에 실패했습니다.', 500);
    }

    // 6. payments 테이블에 결제 내역 기록
    const pgResponse = pgResult.data;
    await supabase.from('payments').insert({
      order_id: order.id,
      pg_provider: pgData.provider,
      method: pgResponse?.method || '카드',
      amount: requestedAmount,
      status: 'paid',
      payment_key: paymentKey,
      pg_tid: pgResponse?.transactionKey || pgResponse?.tid || null,
      receipt_url: pgResponse?.receipt?.url || null,
      card_company: pgResponse?.card?.company || null,
      card_number: pgResponse?.card?.number || null,
      installment_months: pgResponse?.card?.installmentPlanMonths || 0,
      paid_at: new Date().toISOString(),
      raw_data: pgResponse,
    });

    return new Response(
      JSON.stringify({ success: true, orderId, amount: requestedAmount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (err) {
    console.error('verify-payment error:', err);
    return errorResponse('결제 검증 중 오류가 발생했습니다.', 500);
  }
});

// ============================================================
// 토스페이먼츠 검증
// ============================================================
async function verifyToss(paymentKey: string, orderId: string, amount: number, secretKey: string) {
  try {
    const encoded = btoa(`${secretKey}:`);
    const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Toss error:', data);
      return { success: false, error: data.message || '토스페이먼츠 결제 검증 실패' };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: '토스페이먼츠 API 연결 실패' };
  }
}

// ============================================================
// KG이니시스 검증
// ============================================================
async function verifyInicis(
  paymentKey: string,
  orderId: string,
  amount: number,
  secretKey: string,
  settings: any,
) {
  try {
    const mid = settings?.mid || settings?.client_key;
    const timestamp = Date.now().toString();

    // 이니시스 승인 API
    const res = await fetch('https://api.inicis.com/v2/pg/payments/capture', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': secretKey,
      },
      body: JSON.stringify({
        merchantId: mid,
        paymentId: paymentKey,
        orderId,
        amount,
        timestamp,
      }),
    });

    const data = await res.json();

    if (!res.ok || data.code !== '0000') {
      return { success: false, error: data.message || 'KG이니시스 결제 검증 실패' };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: 'KG이니시스 API 연결 실패' };
  }
}

// ============================================================
// 키움페이 검증
// ============================================================
async function verifyKiwoom(
  paymentKey: string,
  orderId: string,
  amount: number,
  secretKey: string,
  settings: any,
) {
  try {
    const mid = settings?.mid;

    const res = await fetch('https://api.kiwoompay.co.kr/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({ paymentKey, orderId, amount, mid }),
    });

    const data = await res.json();

    if (!res.ok || data.resultCode !== '0000') {
      return { success: false, error: data.resultMessage || '키움페이 결제 검증 실패' };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: '키움페이 API 연결 실패' };
  }
}

// ============================================================
// NHN KCP 검증
// ============================================================
async function verifyKcp(
  paymentKey: string,
  orderId: string,
  amount: number,
  secretKey: string,
  settings: any,
) {
  try {
    const siteCode = settings?.site_code;

    const res = await fetch('https://api.kcp.co.kr/v1/payment/approval', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        site_cd: siteCode,
        tno: paymentKey,
        amount,
        order_id: orderId,
      }),
    });

    const data = await res.json();

    if (!res.ok || data.res_cd !== '0000') {
      return { success: false, error: data.res_msg || 'NHN KCP 결제 검증 실패' };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: 'NHN KCP API 연결 실패' };
  }
}

// ============================================================
// 나이스페이먼츠 검증
// ============================================================
async function verifyNicepay(
  paymentKey: string,
  orderId: string,
  amount: number,
  secretKey: string,
  settings: any,
) {
  try {
    const clientId = settings?.client_id;
    const encoded = btoa(`${clientId}:${secretKey}`);

    const res = await fetch(`https://api.nicepay.co.kr/v1/payments/${paymentKey}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount, orderId }),
    });

    const data = await res.json();

    if (!res.ok || data.resultCode !== '0000') {
      return { success: false, error: data.resultMsg || '나이스페이먼츠 결제 검증 실패' };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: '나이스페이먼츠 API 연결 실패' };
  }
}

function errorResponse(message: string, status: number) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
  );
}
