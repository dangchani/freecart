import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GF_API_DEFAULT = 'https://api.goodsflow.io';

// ---------------------------------------------------------------------------
// 굿스플로 연동 정보 조회 (API Key + Base URL)
// ---------------------------------------------------------------------------

interface GfConfig { apiKey: string; apiBase: string; sellerCode: string | null; env: 'prod' | 'test'; }

async function getGfConfig(supabase: ReturnType<typeof createClient>): Promise<GfConfig> {
  const { data, error } = await supabase
    .from('external_connections')
    .select('credentials, is_active')
    .eq('platform', 'goodsflow')
    .maybeSingle();
  if (error || !data || !data.is_active) throw new Error('굿스플로 연동이 설정되지 않았습니다.');
  const creds = data.credentials as Record<string, any>;

  // use_test 는 string 'true' 또는 boolean true 로 저장될 수 있음
  const useTest = creds?.use_test === 'true' || creds?.use_test === true;

  const apiKey = useTest
    ? (creds?.api_key_test || creds?.api_key_prod || '')
    : (creds?.api_key_prod || '');
  if (!apiKey) throw new Error(useTest ? '굿스플로 테스트 API Key가 없습니다.' : '굿스플로 운영 API Key가 없습니다.');

  const sellerCode = useTest
    ? (creds?.seller_code_test || creds?.seller_code_prod || null)
    : (creds?.seller_code_prod || null);

  const apiBase = useTest
    ? ((creds?.api_base_test as string) ?? '').trim().replace(/\/$/, '') || 'https://test-api.goodsflow.io'
    : ((creds?.api_base_prod as string) ?? '').trim().replace(/\/$/, '') || GF_API_DEFAULT;

  const env = useTest ? 'test' : 'prod';
  console.log(`[gf-config] env=${env}, apiBase=${apiBase}, sellerCode=${sellerCode}`);
  return { apiKey, apiBase, sellerCode, env };
}

// ---------------------------------------------------------------------------
// 출고지 목록 조회
// ---------------------------------------------------------------------------

async function getCenters({ apiKey, apiBase }: GfConfig) {
  const url = `${apiBase}/api/centers`;
  console.log(`[getCenters] GET ${url}`);
  const res = await fetch(url, {
    headers: { Authorization: apiKey },
  });
  const body = await res.json();
  console.log(`[getCenters] status=${res.status}, count=${body.data?.length}`);
  if (!res.ok || !body.success) throw new Error(body?.message ?? `출고지 조회 실패 (${res.status})`);

  return (body.data ?? []).map((c: any) => ({
    centerCode:   c.code,
    centerName:   c.name,
    fromName:     c.sellerName ?? c.name,
    fromPhoneNo:  c.phoneNo1 ?? '',
    fromAddress1: c.address1 ?? '',
    fromAddress2: c.address2 ?? '',
    fromZipcode:  c.zipCode ?? '',
  }));
}

// ---------------------------------------------------------------------------
// 계약 목록 조회
// ---------------------------------------------------------------------------

async function getContracts({ apiKey, apiBase }: GfConfig, centerCodes: string) {
  const url = `${apiBase}/api/contracts/center/${encodeURIComponent(centerCodes)}`;
  console.log(`[getContracts] GET ${url}`);
  const res = await fetch(url, {
    headers: { Authorization: apiKey },
  });
  const body = await res.json();
  console.log(`[getContracts] status=${res.status}, count=${body.data?.length}`);
  if (!res.ok || !body.success) throw new Error(body?.message ?? `계약 조회 실패 (${res.status})`);

  return (body.data ?? [])
    .filter((c: any) => c.status === 'APPROVED')
    .map((c: any) => ({
      centerCode:    c.center?.code ?? '',
      contractId:    c.contractId ?? '',
      status:        c.status ?? '',
      transporter:   c.transporter ?? '',
      contractCode:  c.contractCode ?? '',
      contractRates: (c.contractRates ?? []).map((r: any) => ({
        boxSize:     r.boxSize ?? '',
        boxSizeName: r.boxSizeName ?? '',
        creditCost:  r.creditCost ?? 0,
        collectCost: r.collectCost ?? 0,
        returnCost:  r.returnCost ?? 0,
      })),
    }));
}

// ---------------------------------------------------------------------------
// 판매자 목록 조회
// ---------------------------------------------------------------------------

async function getSellers({ apiKey, apiBase }: GfConfig) {
  const url = `${apiBase}/api/sellers`;
  console.log(`[getSellers] GET ${url}`);
  const res = await fetch(url, {
    headers: { Authorization: apiKey },
  });
  const body = await res.json();
  console.log(`[getSellers] status=${res.status}, count=${body.data?.length}`);
  if (!res.ok || !body.success) throw new Error(body?.message ?? `판매자 조회 실패 (${res.status})`);

  return (body.data ?? []).map((s: any) => ({
    sellerCode: s.sellerCode ?? '',
    sellerName: s.sellerName ?? '',
  }));
}

// ---------------------------------------------------------------------------
// 출고지 캐시에서 센터 정보 조회
// ---------------------------------------------------------------------------

async function getCenterFromCache(
  supabase: ReturnType<typeof createClient>,
  centerCode: string,
  env: 'prod' | 'test',
) {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', `gf_centers_${env}`)
    .maybeSingle();
  const centers: any[] = data?.value ?? [];
  return centers.find((c: any) => c.centerCode === centerCode) ?? null;
}

// ---------------------------------------------------------------------------
// requestId 생성
// ---------------------------------------------------------------------------

function generateRequestId(): string {
  const now = new Date();
  const d = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const t = `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}${String(now.getMilliseconds()).padStart(3,'0')}`;
  return `REQ-${d}-${t}`;
}

// ---------------------------------------------------------------------------
// 송장 발급 (물품정보분리 API)
// ---------------------------------------------------------------------------

async function printLabels(
  { apiKey, apiBase }: GfConfig,
  supabase: ReturnType<typeof createClient>,
  items: any[],
  options: { centerCode: string; transporter: string; boxSize: string },
  env: 'prod' | 'test',
) {
  // 출고지 정보를 캐시에서 조회
  const center = await getCenterFromCache(supabase, options.centerCode, env);

  const now = new Date();
  const orderDateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const gfItems = items.map((item: any) => ({
    centerCode:            options.centerCode,
    uniqueId:              `${item.orderNumber}-${Date.now()}`,
    boxSize:               options.boxSize,
    transporter:           options.transporter,
    fromName:              center?.fromName ?? '',
    fromPhoneNo:           (center?.fromPhoneNo ?? '').replace(/[^0-9]/g, ''),
    fromAddress1:          center?.fromAddress1 ?? '',
    fromAddress2:          center?.fromAddress2 ?? '',
    fromZipcode:           center?.fromZipcode ?? '',
    toName:                item.toName,
    toPhoneNo:             item.toPhoneNo.replace(/[^0-9]/g, ''),
    toAddress1:            item.toAddress1,
    toAddress2:            item.toAddress2 ?? '',
    toZipcode:             item.toZipcode,
    deliveryMessage:       item.deliveryMessage ?? '',
    consumerName:          item.consumerName ?? item.toName,
    consumerPhoneNo:       (item.consumerPhoneNo ?? item.toPhoneNo).replace(/[^0-9]/g, ''),
    deliveryPaymentMethod: 'SENDER_PAY',
    deliveryItems:         (item.deliveryItems && item.deliveryItems.length > 0)
      ? item.deliveryItems.map((di: any) => ({
          orderNo:      di.orderNo ?? item.orderNumber,
          orderDate:    di.orderDate ?? item.orderDate ?? orderDateStr,
          name:         di.name,
          quantity:     di.quantity ?? 1,
          price:        di.price ?? 0,
          ...(di.code ? { code: di.code } : {}),
          ...(di.option ? { option: di.option } : {}),
        }))
      : [{
          orderNo:  item.orderNumber,
          orderDate: item.orderDate ?? orderDateStr,
          name:     item.itemName ?? '상품',
          quantity: item.itemQuantity ?? 1,
          price:    item.itemPrice ?? 0,
        }],
  }));

  const url = `${apiBase}/api/deliveries/shipping/print/deliveryItems`;
  const requestId = generateRequestId();
  const requestBody = {
    requestId,
    contractType: 'USER',
    items:        gfItems,
  };
  console.log(`[printLabels] POST ${url}, requestId=${requestId}, items=${gfItems.length}`);
  console.log(`[printLabels] 요청 body:`, JSON.stringify(requestBody, null, 2));

  const res = await fetch(url, {
    method:  'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body:    JSON.stringify(requestBody),
  });
  const body = await res.json();
  console.log(`[printLabels] 응답 status=${res.status}, body:`, JSON.stringify(body, null, 2));
  if (!res.ok) throw new Error(body.error?.message ?? body.message ?? `굿스플로 API 오류 (${res.status})`);

  const responseItems: any[] = body.data?.items ?? [];
  const results = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const gfResult = responseItems[i];
    const success = gfResult?.success === true;

    if (success) {
      const gfServiceId = gfResult.data?.serviceId;
      const invoiceNo   = gfResult.data?.invoiceNo ?? null;
      // shipments 테이블 upsert
      const { data: existing } = await supabase
        .from('shipments')
        .select('id')
        .eq('order_id', item.orderId)
        .maybeSingle();

      const shipmentFields: Record<string, any> = {
        gf_service_id: gfServiceId,
        status: 'shipped',
        shipped_at: new Date().toISOString(),
      };
      if (invoiceNo) shipmentFields.tracking_number = invoiceNo;

      if (existing) {
        await supabase.from('shipments').update(shipmentFields).eq('id', existing.id);
      } else {
        await supabase.from('shipments').insert({ order_id: item.orderId, ...shipmentFields });
      }

      // 주문 상태 전이 (processing → shipped)
      const { data: order } = await supabase
        .from('orders')
        .select('status')
        .eq('id', item.orderId)
        .maybeSingle();

      if (order?.status === 'processing') {
        await supabase.from('orders')
          .update({ status: 'shipped' })
          .eq('id', item.orderId);
        await supabase.from('order_status_history').insert({
          order_id:    item.orderId,
          from_status: 'processing',
          to_status:   'shipped',
          note:        `굿스플로 송장 발급 (${gfServiceId})`,
        });
      }

      results.push({ orderId: item.orderId, orderNumber: item.orderNumber, success: true, gfServiceId, trackingNumber: invoiceNo });
    } else {
      results.push({
        orderId:     item.orderId,
        orderNumber: item.orderNumber,
        success:     false,
        error:       gfResult?.error?.message ?? '발급 실패',
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// 송장 출력 URI 생성
// ---------------------------------------------------------------------------

async function getPrintUri(
  { apiKey, apiBase }: GfConfig,
  supabase: ReturnType<typeof createClient>,
  gfServiceIds: string[],
) {
  const url = `${apiBase}/api/deliveries/shipping/print-uri?idType=serviceId&includePrinted=true`;
  console.log(`[getPrintUri] PUT ${url}, ids=${gfServiceIds.join(',')}`);

  const res = await fetch(url, {
    method:  'PUT',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body:    JSON.stringify(gfServiceIds),
  });
  const body = await res.json();
  console.log(`[getPrintUri] 응답 status=${res.status}, body:`, JSON.stringify(body, null, 2));
  if (!res.ok || !body.success) throw new Error(body.error?.message ?? body.message ?? '출력 URI 생성 실패');

  // 출력 상태 DB 업데이트
  for (const sid of gfServiceIds) {
    await supabase.from('shipments')
      .update({ gf_printed: true, gf_printed_at: new Date().toISOString() })
      .eq('gf_service_id', sid);
  }

  return {
    uri:            body.data?.uri as string,
    requestCount:   body.data?.requestCount ?? 0,
    printCount:     body.data?.printCount ?? 0,
    expireDateTime: body.data?.expireDateTime ?? '',
  };
}

// ---------------------------------------------------------------------------
// 송장 취소
// ---------------------------------------------------------------------------

async function cancelShipping(
  { apiKey, apiBase }: GfConfig,
  supabase: ReturnType<typeof createClient>,
  gfServiceId: string,
  reasonCode: string,
  contents?: string,
) {
  const cancelItem: Record<string, string> = { id: gfServiceId, reasonType: reasonCode };
  if (contents) cancelItem.contents = contents;

  console.log(`[cancelShipping] DELETE ${apiBase}/api/deliveries/cancel`, JSON.stringify({ items: [cancelItem] }));

  const res = await fetch(`${apiBase}/api/deliveries/cancel`, {
    method:  'DELETE',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ items: [cancelItem] }),
  });
  const body = await res.json();
  console.log(`[cancelShipping] 응답 status=${res.status}, body:`, JSON.stringify(body, null, 2));
  if (!res.ok || !body.success) throw new Error(body.error?.message ?? body.message ?? '취소 실패');

  // DB 상태 업데이트: shipments + 주문 상태 전이
  const { data: shipment } = await supabase
    .from('shipments')
    .select('id, order_id')
    .eq('gf_service_id', gfServiceId)
    .maybeSingle();

  if (shipment) {
    await supabase.from('shipments')
      .update({ status: 'cancelled' })
      .eq('id', shipment.id);

    if (shipment.order_id) {
      const { data: order } = await supabase
        .from('orders')
        .select('status')
        .eq('id', shipment.order_id)
        .maybeSingle();

      if (order?.status === 'shipped') {
        await supabase.from('orders')
          .update({ status: 'processing' })
          .eq('id', shipment.order_id);
        await supabase.from('order_status_history').insert({
          order_id:    shipment.order_id,
          from_status: 'shipped',
          to_status:   'processing',
          note:        `굿스플로 송장 취소 (${reasonCode})`,
        });
      }
    }
  }

  return body.data;
}

// ---------------------------------------------------------------------------
// Pull 동기화 — 미수신 웹훅 이벤트 처리
// ---------------------------------------------------------------------------

async function pullWebhooks({ apiKey, apiBase }: GfConfig, supabase: ReturnType<typeof createClient>) {
  const res = await fetch(`${apiBase}/api/deliveries/webhooks`, {
    headers: { Authorization: apiKey },
  });
  const body = await res.json();
  if (!res.ok || !body.success) return;

  const events: any[] = body.data ?? [];
  const GF_STATUS_MAP: Record<string, string> = {
    COMPLETED: 'delivered',
    CANCELED:  'cancelled',
  };

  for (const event of events) {
    const { serviceId, deliveryStatus } = event;

    const { data: shipment } = await supabase
      .from('shipments')
      .select('order_id')
      .eq('gf_service_id', serviceId)
      .maybeSingle();

    if (!shipment?.order_id) continue;

    await supabase.from('gf_delivery_logs').insert({
      order_id:        shipment.order_id,
      gf_service_id:   serviceId,
      delivery_status: deliveryStatus,
      raw_payload:     event,
    });

    const toStatus = GF_STATUS_MAP[deliveryStatus];
    if (toStatus) {
      const { data: order } = await supabase.from('orders').select('status').eq('id', shipment.order_id).maybeSingle();
      if (order && order.status !== toStatus) {
        await supabase.from('orders').update({ status: toStatus }).eq('id', shipment.order_id);
        await supabase.from('order_status_history').insert({
          order_id:    shipment.order_id,
          from_status: order.status,
          to_status:   toStatus,
          note:        `굿스플로 Pull 동기화: ${deliveryStatus}`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 메인 핸들러
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase    = createClient(supabaseUrl, serviceKey);

  try {
    const { action, overrideApiKey, overrideApiBase, ...params } = await req.json() as Record<string, any>;

    let config: GfConfig;
    if (overrideApiKey) {
      const base = ((overrideApiBase as string) ?? '').trim().replace(/\/$/, '') || GF_API_DEFAULT;
      const isTestBase = base.includes('test-api');
      config = { apiKey: overrideApiKey as string, apiBase: base, sellerCode: null, env: isTestBase ? 'test' : 'prod' };
    } else {
      config = await getGfConfig(supabase);
    }

    let result: unknown;

    switch (action) {
      case 'getCenters':
        result = { ok: true, centers: await getCenters(config) };
        break;

      case 'getContracts':
        result = { ok: true, contracts: await getContracts(config, params.centerCodes) };
        break;

      case 'getSellers':
        result = { ok: true, sellers: await getSellers(config) };
        break;

      case 'print':
        result = { ok: true, results: await printLabels(config, supabase, params.items, params.options, config.env) };
        break;

      case 'printUri': {
        const printUriResult = await getPrintUri(config, supabase, params.gfServiceIds);
        result = { ok: true, ...printUriResult };
        break;
      }

      case 'cancel': {
        const cancelResult = await cancelShipping(config, supabase, params.gfServiceId, params.reasonCode, params.contents);
        result = { ok: true, data: cancelResult };
        break;
      }

      case 'pullWebhooks':
        await pullWebhooks(config, supabase);
        result = { ok: true };
        break;

      default:
        result = { ok: false, message: `알 수 없는 action: ${action}` };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, message: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
