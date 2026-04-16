-- =============================================================================
-- Migration: 리뷰 테이블 관리자 RLS 정책 추가
-- reviews 테이블에 관리자 전체 권한 정책이 없어 숨기기·베스트·답변 기능이 동작하지 않는 문제 수정
-- =============================================================================

DROP POLICY IF EXISTS "reviews_admin_all" ON reviews;
CREATE POLICY "reviews_admin_all" ON reviews
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
