import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase     = createClient(supabaseUrl, serviceKey);

  try {
    const { webhook_id, event_type, payload } = await req.json() as {
      webhook_id: string;
      event_type: string;
      payload: Record<string, unknown>;
    };

    // 웹훅 설정 조회
    const { data: cfg, error: cfgErr } = await supabase
      .from('webhook_configs')
      .select('id, url, secret, is_active')
      .eq('id', webhook_id)
      .single();

    if (cfgErr || !cfg || !cfg.is_active) {
      return new Response(JSON.stringify({ ok: false, message: 'webhook not found or inactive' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const body = JSON.stringify({
      event:     event_type,
      payload,
      timestamp: new Date().toISOString(),
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': event_type,
    };
    if (cfg.secret) {
      headers['X-Webhook-Secret'] = cfg.secret;
    }

    const startMs = Date.now();
    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let status = 'failed';

    try {
      const res = await fetch(cfg.url, {
        method:  'POST',
        headers,
        body,
        signal:  AbortSignal.timeout(10_000), // 10초 타임아웃
      });
      statusCode   = res.status;
      responseBody = await res.text().catch(() => null);
      status = res.ok ? 'success' : 'failed';
    } catch (fetchErr) {
      responseBody = String(fetchErr);
    }

    const durationMs = Date.now() - startMs;

    // 로그 기록
    await supabase.from('webhook_logs').insert({
      webhook_id:    webhook_id,
      event:         event_type,
      payload,
      status,
      response_code: statusCode,
      response_body: responseBody ? responseBody.slice(0, 2000) : null,
      duration_ms:   durationMs,
      sent_at:       new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ ok: status === 'success', status_code: statusCode, duration_ms: durationMs }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, message: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
