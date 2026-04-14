-- inquiries 테이블 관리자 RLS 정책 추가
-- 관리자가 전체 문의 조회·답변 등록 가능하도록

DROP POLICY IF EXISTS "inquiries_admin_all" ON inquiries;
CREATE POLICY "inquiries_admin_all" ON inquiries
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
