-- 일괄배송 기능 사용 여부 system_settings 추가
INSERT INTO system_settings (key, value, description)
VALUES (
  'use_bulk_shipment',
  'true'::jsonb,
  '일괄배송 기능 사용 여부. true이면 관리자 주문 메뉴에 일괄 발송 메뉴가 표시됨'
)
ON CONFLICT (key) DO NOTHING;
