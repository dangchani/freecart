import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GF_STATUS_TO_ORDER: Record<string, string> = {
  COMPLETED: 'delivered',
  CANCELED:  'cancelled',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase    = createClient(supabaseUrl, serviceKey);

  try {
    // 굿스플로는 배열 또는 단건 객체로 전송할 수 있음
    const raw = await req.json();
    const events: any[] = Array.isArray(raw) ? raw : [raw];

    for (const event of events) {
      const { serviceId, deliveryStatus } = event;
      if (!serviceId) continue;

      // shipments에서 order_id 조회
      const { data: shipment } = await supabase
        .from('shipments')
        .select('order_id')
        .eq('gf_service_id', serviceId)
        .maybeSingle();

      if (!shipment?.order_id) {
        // 매핑 못 찾아도 로그는 남김
        await supabase.from('gf_delivery_logs').insert({
          gf_service_id:   serviceId,
          delivery_status: deliveryStatus,
          raw_payload:     event,
        });
        continue;
      }

      // 로그 기록
      await supabase.from('gf_delivery_logs').insert({
        order_id:        shipment.order_id,
        gf_service_id:   serviceId,
        delivery_status: deliveryStatus,
        raw_payload:     event,
      });

      // 주문 상태 전이
      const toStatus = GF_STATUS_TO_ORDER[deliveryStatus];
      if (toStatus) {
        const { data: order } = await supabase
          .from('orders')
          .select('status')
          .eq('id', shipment.order_id)
          .maybeSingle();

        if (order && order.status !== toStatus) {
          await supabase.from('orders').update({ status: toStatus }).eq('id', shipment.order_id);
          await supabase.from('order_status_history').insert({
            order_id:    shipment.order_id,
            from_status: order.status,
            to_status:   toStatus,
            note:        `굿스플로 웹훅: ${deliveryStatus}`,
          });
        }
      }
    }

    // 굿스플로는 200 응답을 기대
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, message: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
