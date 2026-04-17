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
    const { userId } = await req.json() as { userId: string };
    if (!userId) throw new Error('userId 필요');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 유저 정보 조회
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', userId)
      .single();
    if (userErr || !user?.email) throw new Error('유저를 찾을 수 없습니다.');

    // 기존 미사용 토큰 무효화 (이전 토큰 재발송 방지)
    await supabase
      .from('email_verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('used_at', null);

    // 새 토큰 생성
    const token = generateToken();
    const { error: tokenErr } = await supabase
      .from('email_verification_tokens')
      .insert({ user_id: userId, token });
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

    const siteName   = cfg.site_name || '쇼핑몰';
    const fromEmail  = cfg.smtp_sender_email || 'noreply@example.com';
    const fromName   = cfg.smtp_sender_name  || siteName;
    const verifyUrl  = `${Deno.env.get('SITE_URL') || 'http://localhost:5173'}/auth/verify-email?token=${token}`;
    const subject    = `[${siteName}] 이메일 인증을 완료해주세요`;
    const htmlBody   = `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#333;">
  <h2 style="color:#1a1a2e;">[${siteName}] 이메일 인증 안내</h2>
  <p>안녕하세요, <strong>${user.name}</strong>님.</p>
  <p>회원가입을 완료하려면 아래 버튼을 클릭하여 이메일을 인증해주세요.</p>
  <p style="margin:24px 0;">
    <a href="${verifyUrl}"
       style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
      이메일 인증하기
    </a>
  </p>
  <p style="font-size:13px;color:#666;">인증 링크는 <strong>24시간</strong> 후 만료됩니다.</p>
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
