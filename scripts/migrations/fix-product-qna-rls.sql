-- product_qna 테이블 RLS 활성화 및 정책 추가
-- 비밀글은 작성자 본인과 관리자만 조회 가능

ALTER TABLE product_qna ENABLE ROW LEVEL SECURITY;

-- 일반 공개글: 누구나 읽기 가능
DROP POLICY IF EXISTS "product_qna_read_public" ON product_qna;
CREATE POLICY "product_qna_read_public" ON product_qna
  FOR SELECT USING (is_secret = false AND is_visible = true);

-- 비밀글: 작성자 본인만 읽기 가능
DROP POLICY IF EXISTS "product_qna_read_own_secret" ON product_qna;
CREATE POLICY "product_qna_read_own_secret" ON product_qna
  FOR SELECT USING (is_secret = true AND auth.uid()::text = user_id::text);

-- 관리자: 전체 조회·수정 가능
DROP POLICY IF EXISTS "product_qna_admin_all" ON product_qna;
CREATE POLICY "product_qna_admin_all" ON product_qna
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- 작성자: 본인 글 등록·수정·삭제 가능
DROP POLICY IF EXISTS "product_qna_manage_own" ON product_qna;
CREATE POLICY "product_qna_manage_own" ON product_qna
  FOR ALL USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);
