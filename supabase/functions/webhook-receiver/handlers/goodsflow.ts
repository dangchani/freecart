import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 굿스플로 배송 상태 → Freecart 주문 상태 매핑
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
 * 굿스플로 웹훅 핸들러
 *
 * - 웹훅 페이로드: JSON 배열 또는 단건 객체
 * - 각 이벤트에서 invoiceNo → shipments.tracking_number 저장
 * - transporter → shipping_company_id 매핑 저장
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

    // shipments에서 order_id 조회
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

    // shipping_company_id가 아직 없으면 transporter로 매핑
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

    // 배송 상태 반영 → shipments.status
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
      // 이미 처리된 이벤트 → 중복 skip
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

        // 배송 출발 시 고객 알림 (설정이 켜져 있을 때만)
        if (toStatus === 'out_for_delivery' && notifyOutForDelivery) {
          // TODO: 고객 알림 발송 (카카오 알림톡 / SMS)
          // 현재는 로그만 기록
          console.log(`[handleGoodsflow] out_for_delivery 알림 대상: order_id=${shipment.order_id}`);
        }
      }
    }

    processed++;
  }

  return { ok: true, processed };
}
