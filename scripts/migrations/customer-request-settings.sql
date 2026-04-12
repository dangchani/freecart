-- Phase 5: 고객 반품/교환 신청 허용 설정
-- system_settings 테이블에 기본값 삽입
-- 기본값 true → 기존 동작(고객 직접 신청 가능) 유지

INSERT INTO system_settings (key, value, description) VALUES
  ('allow_customer_return', 'true'::jsonb,
   '고객이 마이페이지에서 직접 반품 신청 가능 여부. false이면 반품 신청 폼 대신 고객센터 안내 메시지 표시'),
  ('allow_customer_exchange', 'true'::jsonb,
   '고객이 마이페이지에서 직접 교환 신청 가능 여부. false이면 교환 신청 폼 대신 고객센터 안내 메시지 표시')
ON CONFLICT (key) DO NOTHING;
