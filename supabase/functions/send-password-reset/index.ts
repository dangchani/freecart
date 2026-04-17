import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

  try {
    const { loginId } = await req.json() as { loginId: string };
    if (!loginId) throw new Error('loginId 필요');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // login_id로 유저 조회
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('login_id', loginId)
      .single();

    // 보안: 존재 여부 노출 않고 성공 응답 (타이밍 공격 방지)
    if (userErr || !user?.email) {
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }

    // 기존 미사용 토큰 무효화
    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('used_at', null);

    // 새 토큰 생성
    const token = generateToken();
    const { error: tokenErr } = await supabase
      .from('password_reset_tokens')
      .insert({ user_id: user.id, token });
    if (tokenErr) throw tokenErr;

    // SMTP 설정 조회
    const { data: rows } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_sender_name', 'smtp_sender_email', 'site_name']);
    const cfg: Record<string, string> = {};
    for (const row of rows ?? []) {
      try { cfg[row.key] = JSON.parse(row.value); } catch { cfg[row.key] = row.value; }
    }

    const siteName  = cfg.site_name || '쇼핑몰';
    const fromEmail = cfg.smtp_sender_email || 'noreply@example.com';
    const fromName  = cfg.smtp_sender_name  || siteName;
    const resetUrl  = `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/auth/reset-password?token=${token}`;
    const subject   = `[${siteName}] 비밀번호 재설정 안내`;
    const htmlBody  = `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#333;">
  <h2 style="color:#1a1a2e;">[${siteName}] 비밀번호 재설정 안내</h2>
  <p>안녕하세요, <strong>${user.name}</strong>님.</p>
  <p>비밀번호 재설정 요청을 받았습니다. 아래 버튼을 클릭하여 새 비밀번호를 설정해주세요.</p>
  <p style="margin:24px 0;">
    <a href="${resetUrl}"
       style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
      비밀번호 재설정
    </a>
  </p>
  <p style="font-size:13px;color:#666;">링크는 <strong>1시간</strong> 후 만료됩니다.</p>
  <p style="font-size:12px;color:#999;">본인이 요청하지 않은 경우 이 메일을 무시하세요.</p>
</div>`;

    const smtpPort = parseInt(cfg.smtp_port || '587', 10);
    const client = new SMTPClient({
      connection: {
        hostname: cfg.smtp_host,
        port:     smtpPort,
        tls:      smtpPort === 465,
        auth:     { username: cfg.smtp_user, password: cfg.smtp_pass },
      },
    });
    await client.send({ from: `${fromName} <${fromEmail}>`, to: user.email, subject, html: htmlBody, content: '' });
    await client.close();

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
});
