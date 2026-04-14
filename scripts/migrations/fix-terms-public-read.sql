-- terms, content_pages 테이블에 RLS + 공개 읽기 정책 추가
-- anon 유저(비로그인)도 활성 약관 및 공개 페이지를 조회할 수 있도록 허용

-- terms 테이블
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;

-- 비로그인 포함 누구나 활성(is_active=true) 약관 조회 가능
CREATE POLICY "terms_select_public" ON terms
  FOR SELECT USING (is_active = true);

-- 관리자는 모든 약관 조회 + 수정 가능
CREATE POLICY "terms_admin_all" ON terms
  FOR ALL USING (is_admin(auth.uid()));

-- content_pages 테이블
ALTER TABLE content_pages ENABLE ROW LEVEL SECURITY;

-- 비로그인 포함 누구나 공개(is_visible=true) 페이지 조회 가능
CREATE POLICY "content_pages_select_public" ON content_pages
  FOR SELECT USING (is_visible = true);

-- 관리자는 모든 페이지 조회 + 수정 가능
CREATE POLICY "content_pages_admin_all" ON content_pages
  FOR ALL USING (is_admin(auth.uid()));
