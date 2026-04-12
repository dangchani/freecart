-- Phase 12: 주문 완료 이메일
-- 트랜잭션 이메일 발송 방식을 선택할 수 있도록 설정 키를 추가합니다.
-- Resend API(기본) 또는 SMTP를 선택적으로 사용합니다.

INSERT INTO settings (key, value, description)
VALUES
  ('email_provider', '"resend"', '트랜잭션 이메일 발송 방식 (resend | smtp)')
ON CONFLICT (key) DO NOTHING;

-- notification_email_enabled, resend_api_key, notification_from_email,
-- notification_from_name 은 Phase 3(phase3-notification.sql)에서 이미 추가됨.
-- smtp_host, smtp_port, smtp_user, smtp_pass, smtp_sender_name, smtp_sender_email 은
-- 기존 settings 테이블에 존재하며 SMTP 방식 선택 시 재사용됩니다.
