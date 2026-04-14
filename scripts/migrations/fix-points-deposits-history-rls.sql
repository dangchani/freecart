-- user_points_history, user_deposits_history 관리자 RLS 정책 추가
-- 구매확정 시 포인트 적립 등 관리자 INSERT가 RLS에 막히는 문제 수정

-- user_points_history: admin full access
DROP POLICY IF EXISTS "user_points_history_admin_all" ON user_points_history;
CREATE POLICY "user_points_history_admin_all" ON user_points_history
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- user_deposits_history: admin full access
DROP POLICY IF EXISTS "user_deposits_history_admin_all" ON user_deposits_history;
CREATE POLICY "user_deposits_history_admin_all" ON user_deposits_history
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
