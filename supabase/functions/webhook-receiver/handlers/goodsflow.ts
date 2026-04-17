import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 굿스플로 배송 상태 → Freecart 주문 상태 매핑 (출고 배송)
const GF_STATUS_TO_ORDER: Record<string, string> = {
  TRANSFERRED: 'transferred',
  PICKUP:      'picked_up',
  DLV_START:   'out_for_delivery',
  COMPLETED:   'delivered',
  CANCELED:    'cancelled',
  RETURNED:    'cancelled',
};

// 굿스플로 배송 상태 → shipments.status 매핑
const GF_STATUS_TO_SHIPMENT: Record<string, string> = {
  TRANSFERRED:   'transferred',
  PICKUP:        'picked_up',
  DLV_START:     'out_for_delivery',
  COMPLETED:     'delivered',
  CANCELED:      'cancelled',
  RETURNED:      'cancelled',
};

// 굿스플로 택배사 코드 → shipping_companies.code 매핑
const GF_TRANSPORTER_TO_CODE: Record<string, string> = {
  KOREX:  'cj',
  HANJIN: 'hanjin',
  LOTTE:  'lotte',
  EPOST:  'epost',
  LOGEN:  'logen',
  KDEXP:  'kdexp',
  DAESIN: 'daeshin',
  ILYANG: 'ilyang',
  CVSNET: 'gspostbox',
};

// 주문 상태 전이 규칙 (인라인, src/constants/orderStatus.ts 와 동기화 유지)
const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending:          ['paid', 'cancelled'],
  paid:             ['processing', 'pending', 'cancelled'],
  processing:       ['shipped', 'paid', 'cancelled'],
  shipped:          ['transferred', 'delivered', 'processing'],
  transferred:      ['picked_up'],
  picked_up:        ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered:        ['confirmed', 'return_requested'],
  confirmed:        [],
  cancelled:        [],
  return_requested: ['returned'],
  returned:         [],
};

function isValidTransition(from: string, to: string): boolean {
  return (ORDER_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * 반품 serviceId 이벤트 처리
 *
 * 굿스플로 반품 택배의 COMPLETED 이벤트 → refunds/exchanges.status = 'collected'
 * invoiceNo 발급 시 → return_tracking_number 저장
 */
async function handleReturnServiceEvent(
  supabase: ReturnType<typeof createClient>,
  serviceId: string,
  deliveryStatus: string,
  invoiceNo: string | null,
  transporter: string | null,
  seq: number | null,
  event: unknown,
): Promise<boolean> {
  // refunds에서 조회
  const { data: refund } = await supabase
    .from('refunds')
    .select('id, status, order_id')
    .eq('gf_return_service_id', serviceId)
    .maybeSingle();

  // exchanges에서 조회
  const { data: exchange } = await supabase
    .from('exchanges')
    .select('id, status, order_id')
    .eq('gf_return_service_id', serviceId)
    .maybeSingle();

  if (!refund && !exchange) return false;

  const now = new Date().toISOString();

  // gf_delivery_logs 기록
  const logFields: Record<string, any> = {
    gf_service_id:   serviceId,
    delivery_status: deliveryStatus,
    raw_payload:     event,
    seq:             seq ?? null,
  };
  if (refund)   { logFields.order_id = refund.order_id;   logFields.refund_id   = refund.id;   }
  if (exchange) { logFields.order_id = exchange.order_id; logFields.exchange_id = exchange.id; }

  const { error: logError } = await supabase.from('gf_delivery_logs').insert(logFields);
  if (logError && logError.code !== '23505') {
    console.error(`[handleGoodsflow] return log insert error (seq=${seq}):`, logError.message);
  }
  if (logError?.code === '23505') {
    console.log(`[handleGoodsflow] 반품 중복 이벤트 skip: serviceId=${serviceId}, seq=${seq}`);
    return true;
  }

  // shipping_company_id 조회 (invoiceNo/transporter 있을 때)
  let returnCompanyId: string | null = null;
  if (transporter) {
    const companyCode = GF_TRANSPORTER_TO_CODE[transporter];
    if (companyCode) {
      const { data: company } = await supabase
        .from('shipping_companies').select('id').eq('code', companyCode).maybeSingle();
      if (company) returnCompanyId = company.id;
    }
  }

  if (deliveryStatus === 'COMPLETED') {
    // 수거 완료 → collected
    if (refund && refund.status === 'pickup_requested') {
      const updateFields: Record<string, any> = {
        status:       'collected',
        collected_at: now,
      };
      if (invoiceNo)      updateFields.return_tracking_number = invoiceNo;
      if (returnCompanyId) updateFields.return_company_id     = returnCompanyId;
      await supabase.from('refunds').update(updateFields).eq('id', refund.id);
      console.log(`[handleGoodsflow] refund ${refund.id} → collected`);
    }

    if (exchange && exchange.status === 'pickup_requested') {
      const updateFields: Record<string, any> = {
        status:       'collected',
        collected_at: now,
      };
      if (invoiceNo)      updateFields.tracking_number  = invoiceNo;
      if (returnCompanyId) updateFields.tracking_company_id = returnCompanyId;
      await supabase.from('exchanges').update(updateFields).eq('id', exchange.id);
      console.log(`[handleGoodsflow] exchange ${exchange.id} → collected`);
    }
  } else if (invoiceNo) {
    // 송장 번호만 업데이트 (PICKUP, TRANSFERRED 등)
    if (refund)   await supabase.from('refunds').update({ return_tracking_number: invoiceNo }).eq('id', refund.id);
    if (exchange) await supabase.from('exchanges').update({ tracking_number: invoiceNo }).eq('id', exchange.id);
  }

  return true;
}

/**
 * 굿스플로 웹훅 핸들러
 *
 * - 웹훅 페이로드: JSON 배열 또는 단건 객체
 * - serviceId → shipments(출고) 또는 refunds/exchanges(반품) 구분하여 처리
 * - 각 이벤트에서 invoiceNo, transporter 매핑 저장
 * - gf_delivery_logs에 기록 (seq 중복 시 skip)
 * - 주문 상태 전이 (isValidTransition 검증)
 * - out_for_delivery: system_settings.notify_out_for_delivery 설정에 따라 알림 발송
 */
export async function handleGoodsflow(
  supabase: ReturnType<typeof createClient>,
  payload: unknown,
): Promise<{ ok: boolean; processed: number }> {
  const events: any[] = Array.isArray(payload) ? payload : [payload];
  let processed = 0;

  // out_for_delivery 알림 설정 조회 (한 번만)
  let notifyOutForDelivery = true;
  {
    const { data: setting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'notify_out_for_delivery')
      .maybeSingle();
    if (setting?.value === 'false' || setting?.value === false) {
      notifyOutForDelivery = false;
    }
  }

  for (const event of events) {
    const { serviceId, deliveryStatus, invoiceNo, transporter, seq } = event;
    if (!serviceId) continue;

    // 1. 반품 serviceId 먼저 확인
    const isReturnEvent = await handleReturnServiceEvent(
      supabase, serviceId, deliveryStatus, invoiceNo ?? null, transporter ?? null, seq ?? null, event,
    );
    if (isReturnEvent) {
      processed++;
      continue;
    }

    // 2. 출고 shipments에서 order_id 조회
    const { data: shipment } = await supabase
      .from('shipments')
      .select('id, order_id, shipping_company_id')
      .eq('gf_service_id', serviceId)
      .maybeSingle();

    if (!shipment?.order_id) {
      // 매핑 못 찾아도 로그는 남김 (seq 중복 skip)
      const { error: logError } = await supabase.from('gf_delivery_logs').insert({
        gf_service_id:   serviceId,
        delivery_status: deliveryStatus,
        raw_payload:     event,
        seq:             seq ?? null,
      });
      if (logError && logError.code !== '23505') {
        console.error(`[handleGoodsflow] log insert error (no shipment, seq=${seq}):`, logError.message);
      }
      continue;
    }

    // shipments 업데이트: invoiceNo + shipping_company_id + 배송 상태
    const updateFields: Record<string, any> = {};

    if (invoiceNo) {
      updateFields.tracking_number = invoiceNo;
    }

    if (!shipment.shipping_company_id && transporter) {
      const companyCode = GF_TRANSPORTER_TO_CODE[transporter];
      if (companyCode) {
        const { data: company } = await supabase
          .from('shipping_companies')
          .select('id')
          .eq('code', companyCode)
          .maybeSingle();
        if (company) updateFields.shipping_company_id = company.id;
      }
    }

    const newShipmentStatus = GF_STATUS_TO_SHIPMENT[deliveryStatus];
    if (newShipmentStatus) {
      updateFields.status = newShipmentStatus;
      if (deliveryStatus === 'COMPLETED') updateFields.delivered_at = new Date().toISOString();
    }

    if (Object.keys(updateFields).length > 0) {
      await supabase.from('shipments').update(updateFields).eq('id', shipment.id);
    }

    // gf_delivery_logs 기록 (seq 중복 시 skip)
    const { error: logError } = await supabase.from('gf_delivery_logs').insert({
      order_id:        shipment.order_id,
      gf_service_id:   serviceId,
      delivery_status: deliveryStatus,
      raw_payload:     event,
      seq:             seq ?? null,
    });
    if (logError && logError.code !== '23505') {
      console.error(`[handleGoodsflow] log insert error (seq=${seq}):`, logError.message);
    }
    if (logError?.code === '23505') {
      console.log(`[handleGoodsflow] 중복 이벤트 skip: serviceId=${serviceId}, seq=${seq}`);
      continue;
    }

    // 주문 상태 전이
    const toStatus = GF_STATUS_TO_ORDER[deliveryStatus];
    if (toStatus) {
      const { data: order } = await supabase
        .from('orders')
        .select('status')
        .eq('id', shipment.order_id)
        .maybeSingle();

      if (order && order.status !== toStatus && isValidTransition(order.status, toStatus)) {
        await supabase.from('orders').update({ status: toStatus }).eq('id', shipment.order_id);
        await supabase.from('order_status_history').insert({
          order_id:    shipment.order_id,
          from_status: order.status,
          to_status:   toStatus,
          note:        `굿스플로 웹훅: ${deliveryStatus}${invoiceNo ? ` (송장: ${invoiceNo})` : ''}`,
        });

        if (toStatus === 'out_for_delivery' && notifyOutForDelivery) {
          // TODO: 고객 알림 발송 (카카오 알림톡 / SMS)
          console.log(`[handleGoodsflow] out_for_delivery 알림 대상: order_id=${shipment.order_id}`);
        }
      }
    }

    processed++;
  }

  return { ok: true, processed };
}
