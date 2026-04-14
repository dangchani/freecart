-- 메인 페이지에서 비로그인 사용자도 읽어야 하는 system_settings 키에 대해 공개 읽기 정책 추가
-- 대상: notice_bar_enabled, notice_bar_color, image_banner_enabled

CREATE POLICY "system_settings_select_public"
  ON system_settings
  FOR SELECT
  USING (key IN ('notice_bar_enabled', 'notice_bar_color', 'image_banner_enabled'));
