-- 예치금 기능 사용 여부 system_settings 추가
INSERT INTO system_settings (key, value, description)
VALUES (
  'use_deposit',
  'false'::jsonb,
  '예치금 기능 사용 여부. true이면 관리자 사이드바에 예치금 관리 메뉴가 표시됨'
)
ON CONFLICT (key) DO NOTHING;
