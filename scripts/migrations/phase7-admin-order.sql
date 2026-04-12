-- Phase 7: 관리자 직접 주문 생성
-- 관리자가 전화·방문 주문 등을 수동으로 생성할 수 있도록 플래그 컬럼을 추가합니다.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_admin_order BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN orders.is_admin_order IS '관리자 직접 생성 주문 여부';
