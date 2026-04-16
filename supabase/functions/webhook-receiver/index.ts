import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleGoodsflow } from './handlers/goodsflow.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// ---------------------------------------------------------------------------
// 소스별 핸들러 맵 — 새 소스 추가 시 여기에 등록
// ---------------------------------------------------------------------------

type HandlerFn = (
  supabase: ReturnType<typeof createClient>,
  payload: unknown,
) => Promise<{ ok: boolean; message?: string; processed?: number }>;

const HANDLERS: Record<string, HandlerFn> = {
  goodsflow: handleGoodsflow,
};

// ---------------------------------------------------------------------------
// 메인 핸들러
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase    = createClient(supabaseUrl, serviceKey);

  const url    = new URL(req.url);
  const source = url.searchParams.get('source') ?? '';

  if (!source) {
    return new Response(
      JSON.stringify({ ok: false, message: 'source 파라미터가 필요합니다.' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  try {
    // 1. 소스 활성 여부 확인
    const { data: inbound } = await supabase
      .from('inbound_webhooks')
      .select('secret_key, is_active')
      .eq('source', source)
      .maybeSingle();

    if (!inbound || !inbound.is_active) {
      // 등록되지 않았거나 비활성 — 로그만 남기고 200 응답 (재시도 방지)
      console.warn(`[webhook-receiver] 비활성 또는 미등록 소스: ${source}`);
      return new Response(
        JSON.stringify({ ok: true, message: '소스가 비활성 상태입니다.' }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // 2. 비밀키 검증 (설정되어 있는 경우만)
    const secretKey    = inbound.secret_key;
    const headerSecret = req.headers.get('x-webhook-secret');
    const isVerified   = !secretKey || (headerSecret === secretKey);

    // 3. 페이로드 파싱
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    // 4. 수신 로그 기록 (inbound_webhook_logs)
    const eventType = Array.isArray(payload)
      ? `batch(${(payload as any[]).length})`
      : ((payload as any)?.deliveryStatus ?? (payload as any)?.eventType ?? null);

    await supabase.from('inbound_webhook_logs').insert({
      source,
      event_type:  eventType,
      payload:     payload as any,
      is_verified: isVerified,
    });

    // 5. 비밀키 불일치 시 로그는 남기되 처리는 스킵
    if (!isVerified) {
      console.warn(`[webhook-receiver] 비밀키 불일치: source=${source}`);
      return new Response(
        JSON.stringify({ ok: false, message: '비밀키가 일치하지 않습니다.' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // 6. 소스별 핸들러 실행
    const handler = HANDLERS[source];
    if (handler) {
      const result = await handler(supabase, payload);
      console.log(`[webhook-receiver] ${source} 처리 완료:`, result);
      return new Response(
        JSON.stringify(result),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // 핸들러 없는 소스 — 로그만 기록, 200 응답
    console.log(`[webhook-receiver] 핸들러 없는 소스: ${source}, 로그만 기록`);
    return new Response(
      JSON.stringify({ ok: true, message: '로그 기록 완료' }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error(`[webhook-receiver] 오류: source=${source}`, err);
    return new Response(
      JSON.stringify({ ok: false, message: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
