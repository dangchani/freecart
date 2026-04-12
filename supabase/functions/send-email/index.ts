import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

serve(async (req) => {
  const { userId, subject, content, htmlContent, template } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 수신자 이메일 조회
  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  if (!user?.email) {
    return new Response(JSON.stringify({ error: 'User email not found' }), { status: 400 });
  }

  // 발송 설정 조회
  const { data: rows } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [
      'resend_api_key',
      'notification_from_email',
      'notification_from_name',
      'notification_email_enabled',
      'email_provider',
      'smtp_host',
      'smtp_port',
      'smtp_user',
      'smtp_pass',
      'smtp_sender_name',
      'smtp_sender_email',
    ]);

  const cfg: Record<string, string> = {};
  for (const row of rows ?? []) {
    try { cfg[row.key] = JSON.parse(row.value); } catch { cfg[row.key] = row.value; }
  }

  if (cfg.notification_email_enabled === 'false' || cfg.notification_email_enabled === false) {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  const fromEmail = cfg.notification_from_email || cfg.smtp_sender_email || 'noreply@example.com';
  const fromName  = cfg.notification_from_name  || cfg.smtp_sender_name  || '프리카트';
  const htmlBody  = htmlContent || `<p>${content}</p>`;

  // email_logs 에 pending 기록
  const { data: logEntry } = await supabase
    .from('email_logs')
    .insert({
      user_id:  userId,
      to_email: user.email,
      template: template || 'notification',
      subject,
      status:   'pending',
    })
    .select('id')
    .single();

  const logId = logEntry?.id;
  const emailProvider = cfg.email_provider || 'resend';

  try {
    if (emailProvider === 'smtp') {
      // SMTP 발송 (denomailer)
      const smtpHost = cfg.smtp_host;
      const smtpPort = parseInt(cfg.smtp_port || '587', 10);
      const smtpUser = cfg.smtp_user;
      const smtpPass = cfg.smtp_pass;

      if (!smtpHost || !smtpUser || !smtpPass) {
        throw new Error('SMTP 설정이 완전하지 않습니다 (host/user/pass 필요)');
      }

      const client = new SMTPClient({
        connection: {
          hostname: smtpHost,
          port:     smtpPort,
          tls:      smtpPort === 465,
          auth:     { username: smtpUser, password: smtpPass },
        },
      });

      await client.send({
        from:    `${fromName} <${fromEmail}>`,
        to:      user.email,
        subject,
        html:    htmlBody,
        content: content || '',
      });
      await client.close();
    } else {
      // Resend API 발송
      const apiKey = cfg.resend_api_key;
      if (!apiKey) throw new Error('Resend API key not configured');

      const res = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    `${fromName} <${fromEmail}>`,
          to:      [user.email],
          subject,
          html:    htmlBody,
          text:    content,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }
    }

    if (logId) {
      await supabase
        .from('email_logs')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', logId);
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    if (logId) {
      await supabase
        .from('email_logs')
        .update({ status: 'failed', error_message: String(err) })
        .eq('id', logId);
    }
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
