import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  try {
    const { token, newPassword } = await req.json() as { token: string; newPassword: string };
    if (!token || !newPassword) throw new Error('token, newPassword 필요');
    if (newPassword.length < 8) throw new Error('WEAK_PASSWORD');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 토큰 조회
    const { data: row, error: rowErr } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token', token)
      .single();

    if (rowErr || !row) throw new Error('INVALID_TOKEN');
    if (row.used_at) throw new Error('ALREADY_USED');
    if (new Date(row.expires_at) < new Date()) throw new Error('EXPIRED');

    // Admin API로 비밀번호 변경
    const { error: updateErr } = await supabase.auth.admin.updateUserById(row.user_id, {
      password: newPassword,
    });
    if (updateErr) throw new Error(updateErr.message);

    // 토큰 사용 처리
    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', row.id);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = String(err);
    const code = msg.includes('INVALID_TOKEN') ? 'INVALID_TOKEN'
               : msg.includes('ALREADY_USED')  ? 'ALREADY_USED'
               : msg.includes('EXPIRED')        ? 'EXPIRED'
               : msg.includes('WEAK_PASSWORD')  ? 'WEAK_PASSWORD'
               : 'ERROR';
    return new Response(JSON.stringify({ error: code }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
});
