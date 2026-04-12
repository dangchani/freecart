-- Phase 3: 알림 이메일 인프라 설정 키 추가

INSERT INTO settings (key, value, description)
VALUES
  ('resend_api_key',            '""',              'Resend API Key (이메일 발송용)'),
  ('notification_from_email',   '"noreply@example.com"', '알림 발신 이메일 주소'),
  ('notification_from_name',    '"프리카트"',       '알림 발신자 이름'),
  ('notification_email_enabled','"true"',           '이메일 알림 활성화 여부 (true/false)')
ON CONFLICT (key) DO NOTHING;
