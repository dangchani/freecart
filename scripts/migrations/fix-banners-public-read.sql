-- banners 테이블에 RLS 활성화 + 공개 읽기 정책 추가
-- anon 유저(비로그인)도 활성 배너를 조회할 수 있도록 명시적으로 허용
-- 관리자는 전체 CRUD 가능

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- 비로그인 포함 누구나 활성 배너 조회 가능
CREATE POLICY "banners_select_public" ON banners
  FOR SELECT USING (is_active = true);

-- 관리자는 모든 배너 조회 + 수정 가능 (비활성 배너 포함)
CREATE POLICY "banners_admin_all" ON banners
  FOR ALL USING (is_admin(auth.uid()));
