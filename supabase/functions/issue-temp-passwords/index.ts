import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function generateTempPassword(): string {
  const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower   = 'abcdefghijklmnopqrstuvwxyz';
  const digits  = '0123456789';
  const special = '!@#$%^*';   // & 제외 (HTML 인코딩 이슈 방지)
  const all     = upper + lower + digits + special;
  const rand    = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const required = [rand(upper), rand(lower), rand(digits), rand(special)];
  const rest     = Array.from({ length: 6 }, () => rand(all));
  const combined = [...required, ...rest];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
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
    let query = supabase.from('users').select('id, login_id, name, email, role');
    if (userIds && userIds.length > 0) {
      query = query.in('id', userIds);
    }
    const { data: users, error: usersError } = await query.order('created_at');
    if (usersError) throw usersError;
    if (!users || users.length === 0) {
      return json({ error: '대상 회원이 없습니다.' }, 400);
    }

    // SMTP 설정 조회
    let emailCfg: Record<string, string> = {};
    let siteName = '쇼핑몰';
    if (sendEmail) {
      const { data: settingsRows, error: settingsError } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', [
          'site_name',
          'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass',
          'smtp_sender_name', 'smtp_sender_email',
          'notification_from_email', 'notification_from_name',
        ]);
      if (settingsError) throw settingsError;

      for (const row of settingsRows ?? []) {
        try { emailCfg[row.key] = JSON.parse(row.value); } catch { emailCfg[row.key] = row.value; }
      }
      if (emailCfg.site_name) siteName = emailCfg.site_name;

      if (!emailCfg.smtp_host || !emailCfg.smtp_user || !emailCfg.smtp_pass) {
        return json({
          error: `SMTP 설정 누락. host=${emailCfg.smtp_host || '없음'}, user=${emailCfg.smtp_user || '없음'}, pass=${emailCfg.smtp_pass ? '설정됨' : '없음'}`,
        }, 400);
      }
    }

    const results: {
      login_id: string; name: string; email: string;
      temp_password: string; email_sent: boolean; error?: string;
    }[] = [];

    for (const user of users) {
      // ① admin / super_admin 제외
      if (user.role === 'admin' || user.role === 'super_admin') {
        results.push({
          login_id: user.login_id, name: user.name, email: user.email,
          temp_password: '', email_sent: false,
          error: '관리자 계정은 임시 비밀번호 발급 대상에서 제외됩니다.',
        });
        continue;
      }

      const tempPassword = generateTempPassword();
      let emailSent = false;
      let rowError: string | undefined;

      // ② auth.identities 없으면 자동 생성 (로그인 가능 상태 보장)
      if (user.email) {
        const { error: identityErr } = await supabase.rpc('ensure_auth_identity', {
          p_user_id: user.id,
          p_email:   user.email,
        });
        if (identityErr) {
          console.warn(`[issue-temp-passwords] ensure_auth_identity 실패 (${user.email}):`, identityErr.message);
        }
      }

      // ③ 비밀번호 변경 — crypt() 직접 방식 (updateUserById 우회)
      //    이유: GoTrue Admin API updateUserById가 일부 환경에서 저장 불일치 발생
      //    직접 SQL crypt()는 로그인 동작 확인됨
      console.log(`[issue-temp-passwords] 비밀번호 변경 시도: ${user.id} (${user.email})`);
      const { error: pwErr } = await supabase.rpc('update_user_password_direct', {
        p_user_id: user.id,
        p_password: tempPassword,
      });

      if (pwErr) {
        console.error(`[issue-temp-passwords] 비밀번호 변경 실패 (${user.email}):`, pwErr.message);
        results.push({
          login_id: user.login_id, name: user.name, email: user.email,
          temp_password: '', email_sent: false,
          error: `비밀번호 변경 실패: ${pwErr.message}`,
        });
        continue;
      }
      console.log(`[issue-temp-passwords] 비밀번호 변경 성공: ${user.email}`);

      // ④ 일반 회원만 must_change_password 플래그 설정
      if (user.role === 'user') {
        await supabase.from('users').update({ must_change_password: true }).eq('id', user.id);
      }

      // ⑤ SMTP 이메일 발송
      if (sendEmail && user.email) {
        try {
          const fromEmail = emailCfg.notification_from_email || emailCfg.smtp_sender_email || emailCfg.smtp_user;
          const fromName  = emailCfg.notification_from_name  || emailCfg.smtp_sender_name  || siteName;
          const smtpPort  = parseInt(emailCfg.smtp_port || '587', 10);

          console.log(`[issue-temp-passwords] SMTP 발송 시도: to=${user.email}, host=${emailCfg.smtp_host}:${smtpPort}`);

          const transporter = nodemailer.createTransport({
            host:   emailCfg.smtp_host,
            port:   smtpPort,
            secure: smtpPort === 465,
            auth: { user: emailCfg.smtp_user, pass: emailCfg.smtp_pass },
          });

          await transporter.sendMail({
            from:    `"${fromName}" <${fromEmail}>`,
            to:      user.email,
            subject: `[${siteName}] 임시 비밀번호 안내`,
            html: `
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
  <p style="color:#e74c3c;font-size:13px;">&#9888; 이 비밀번호는 임시 비밀번호입니다. 로그인 후 즉시 변경해주세요.</p>
</div>`,
          });

          emailSent = true;
          console.log(`[issue-temp-passwords] 이메일 발송 성공: ${user.email}`);
        } catch (e: any) {
          const errMsg = e?.message ?? String(e);
          console.error(`[issue-temp-passwords] 이메일 발송 실패 (${user.email}):`, errMsg);
          rowError = `이메일 발송 실패: ${errMsg}`;
        }
      }

      results.push({
        login_id: user.login_id, name: user.name, email: user.email,
        temp_password: tempPassword, email_sent: emailSent, error: rowError,
      });
    }

    return json({ ok: true, results });

  } catch (err: any) {
    const errMsg = err?.message ?? String(err);
    console.error('[issue-temp-passwords] 최상위 오류:', errMsg);
    return json({ error: errMsg }, 500);
  }
});
