import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  try {
    const { token } = await req.json() as { token: string };
    if (!token) throw new Error('token 필요');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 토큰 조회
    const { data: row, error: rowErr } = await supabase
      .from('email_verification_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token', token)
      .single();

    if (rowErr || !row) throw new Error('INVALID_TOKEN');
    if (row.used_at) throw new Error('ALREADY_USED');
    if (new Date(row.expires_at) < new Date()) throw new Error('EXPIRED');

    // 토큰 사용 처리 + 유저 인증 완료
    const now = new Date().toISOString();
    await Promise.all([
      supabase
        .from('email_verification_tokens')
        .update({ used_at: now })
        .eq('id', row.id),
      supabase
        .from('users')
        .update({ email_verified_at: now, is_email_verified: true })
        .eq('id', row.user_id),
    ]);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = String(err);
    const code = msg.includes('INVALID_TOKEN') ? 'INVALID_TOKEN'
               : msg.includes('ALREADY_USED')  ? 'ALREADY_USED'
               : msg.includes('EXPIRED')        ? 'EXPIRED'
               : 'ERROR';
    return new Response(JSON.stringify({ error: code }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
});
