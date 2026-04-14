-- 공지 배너 활성화 설정 추가
-- notice_bar_enabled: true(기본) = 메인 상단에 최신 공지 1개 표시

INSERT INTO system_settings (key, value)
VALUES ('notice_bar_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
