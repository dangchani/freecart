-- 이미지 배너 섹션 활성화 설정 추가
-- image_banner_enabled: true(기본) = 메인 페이지에 banners 테이블의 배너를 표시

INSERT INTO system_settings (key, value)
VALUES ('image_banner_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
