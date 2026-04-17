-- ============================================================
-- allow_customer_cancel system_settings 키 추가
-- 고객이 마이페이지에서 직접 주문 취소할 수 있는지 여부
-- ============================================================

INSERT INTO system_settings (key, value, description)
VALUES (
  'allow_customer_cancel',
  'true'::jsonb,
  '고객이 마이페이지에서 직접 주문 취소 가능 여부. false이면 취소 버튼 대신 고객센터 안내 메시지 표시'
)
ON CONFLICT (key) DO NOTHING;
