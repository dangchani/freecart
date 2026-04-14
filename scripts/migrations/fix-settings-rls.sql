-- settings 테이블 RLS 정책 추가
-- 푸터·사이트 전체에서 사이트명·사업자정보 등을 읽을 수 있도록 공개 읽기 허용
-- 쓰기는 관리자만 가능

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_public_read" ON settings;
CREATE POLICY "settings_public_read" ON settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "settings_admin_write" ON settings;
CREATE POLICY "settings_admin_write" ON settings
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
