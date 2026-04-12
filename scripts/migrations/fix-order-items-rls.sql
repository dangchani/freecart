-- =============================================================================
-- Fix: order_items RLS 관리자 정책 누락
-- 증상: 관리자가 다른 사용자의 주문 아이템을 직접 쿼리하면 빈 배열 반환
--       (거래명세서, 관리자 직접 쿼리 등에서 품목이 표시되지 않는 문제)
-- 원인: order_items_read_own 정책이 user_id 기반으로만 필터링되어
--       관리자 role 체크가 없음
-- =============================================================================

-- 기존 정책 교체: 관리자도 조회 가능하도록
DROP POLICY IF EXISTS "order_items_read_own" ON order_items;
CREATE POLICY "order_items_read_own" ON order_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders WHERE user_id::text = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- 관리자 전체 관리 정책 추가 (INSERT / UPDATE / DELETE)
DROP POLICY IF EXISTS "order_items_manage_admin" ON order_items;
CREATE POLICY "order_items_manage_admin" ON order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
