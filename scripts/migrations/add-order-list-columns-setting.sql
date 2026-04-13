-- 주문 목록 기본 표시 컬럼 system_settings 추가
INSERT INTO system_settings (key, value, description)
VALUES (
  'order_list_columns',
  '["product","memo","deadline"]'::jsonb,
  '주문 목록 기본 표시 컬럼. localStorage 개인 설정이 없는 관리자에게 적용되는 기본값'
)
ON CONFLICT (key) DO NOTHING;
