import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** 영문 대소문자 + 숫자 + 특수문자 조합 10자 비밀번호 생성 */
function generateTempPassword(): string {
  const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower   = 'abcdefghijklmnopqrstuvwxyz';
  const digits  = '0123456789';
  const special = '!@#$%^&*';
  const all     = upper + lower + digits + special;

  const rand = (chars: string) => chars[Math.floor(Math.random() * chars.length)];

  // 각 종류에서 최소 1자씩 보장
  const required = [rand(upper), rand(lower), rand(digits), rand(special)];
  const rest = Array.from({ length: 6 }, () => rand(all));

  // 셔플
  const combined = [...required, ...rest];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { userIds, sendEmail } = await req.json() as {
      userIds?: string[];
      sendEmail: boolean;
    };

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 대상 회원 조회
    let query = supabase.from('users').select('id, login_id, name, email');
    if (userIds && userIds.length > 0) {
      query = query.in('id', userIds);
    }
    const { data: users, error: usersError } = await query.order('created_at');
    if (usersError) throw usersError;
    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ error: '대상 회원이 없습니다.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // 이메일 발송 설정 조회 (sendEmail=true일 때만)
    let emailCfg: Record<string, string> = {};
    let siteName = '쇼핑몰';
    if (sendEmail) {
      const { data: settingsRows } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', [
          'site_name',
          'resend_api_key', 'notification_from_email', 'notification_from_name',
          'email_provider', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass',
          'smtp_sender_name', 'smtp_sender_email',
        ]);
      for (const row of settingsRows ?? []) {
        try { emailCfg[row.key] = JSON.parse(row.value); } catch { emailCfg[row.key] = row.value; }
      }
      if (emailCfg.site_name) siteName = emailCfg.site_name;
    }

    const results: { login_id: string; name: string; email: string; temp_password: string; email_sent: boolean; error?: string }[] = [];

    for (const user of users) {
      const tempPassword = generateTempPassword();
      let emailSent = false;
      let rowError: string | undefined;

      // Auth 비밀번호 변경 (Admin API)
      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        password: tempPassword,
      });

      if (updateError) {
        results.push({ login_id: user.login_id, name: user.name, email: user.email, temp_password: '', email_sent: false, error: updateError.message });
        continue;
      }

      // 이메일 발송
      if (sendEmail && user.email) {
        try {
          const fromEmail = emailCfg.notification_from_email || emailCfg.smtp_sender_email || 'noreply@example.com';
          const fromName  = emailCfg.notification_from_name  || emailCfg.smtp_sender_name  || siteName;
          const subject   = `[${siteName}] 임시 비밀번호 안내`;
          const htmlBody  = `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#333;">
  <h2 style="color:#1a1a2e;">[${siteName}] 임시 비밀번호 안내</h2>
  <p>안녕하세요, <strong>${user.name}</strong>님.</p>
  <p>임시 비밀번호가 발급되었습니다. 로그인 후 반드시 비밀번호를 변경해주세요.</p>
  <table style="border-collapse:collapse;margin:20px 0;">
    <tr>
      <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">아이디</td>
      <td style="padding:8px 12px;border:1px solid #ddd;">${user.login_id}</td>
    </tr>
    <tr>
      <td style="padding:8px 12px;background:#f5f5f5;font-weight:bold;">임시 비밀번호</td>
      <td style="padding:8px 12px;border:1px solid #ddd;font-family:monospace;font-size:16px;letter-spacing:2px;">${tempPassword}</td>
    </tr>
  </table>
  <p style="color:#e74c3c;font-size:13px;">⚠ 이 비밀번호는 임시 비밀번호입니다. 로그인 후 즉시 변경해주세요.</p>
</div>`;

          const emailProvider = emailCfg.email_provider || 'resend';

          if (emailProvider === 'smtp') {
            // denomailer 동적 import
            const { SMTPClient } = await import('https://deno.land/x/denomailer@1.6.0/mod.ts');
            const client = new SMTPClient({
              connection: {
                hostname: emailCfg.smtp_host,
                port:     parseInt(emailCfg.smtp_port || '587', 10),
                tls:      parseInt(emailCfg.smtp_port || '587', 10) === 465,
                auth:     { username: emailCfg.smtp_user, password: emailCfg.smtp_pass },
              },
            });
            await client.send({ from: `${fromName} <${fromEmail}>`, to: user.email, subject, html: htmlBody, content: '' });
            await client.close();
          } else {
            const res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { Authorization: `Bearer ${emailCfg.resend_api_key}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [user.email], subject, html: htmlBody }),
            });
            if (!res.ok) throw new Error(await res.text());
          }
          emailSent = true;
        } catch (e) {
          rowError = `이메일 발송 실패: ${String(e)}`;
        }
      }

      results.push({ login_id: user.login_id, name: user.name, email: user.email, temp_password: tempPassword, email_sent: emailSent, error: rowError });
    }

    return new Response(
      JSON.stringify({ ok: true, results }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
