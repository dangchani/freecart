-- =============================================================================
-- Fix: orders 테이블 관리자 INSERT RLS 누락
-- 증상: new row violates row-level security policy for table "orders"
-- 원인: orders_insert_own 정책만 존재 (auth.uid() = user_id 조건)
--       관리자가 타 회원 또는 비회원 주문을 생성하면 user_id ≠ auth.uid() 로 차단됨
-- =============================================================================

DROP POLICY IF EXISTS "orders_insert_admin" ON orders;
CREATE POLICY "orders_insert_admin" ON orders
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );
