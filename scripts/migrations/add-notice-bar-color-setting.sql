-- 공지 배너 배경색 설정 추가
-- 기본값: #2563eb (blue-600)

INSERT INTO system_settings (key, value)
VALUES ('notice_bar_color', '"#2563eb"')
ON CONFLICT (key) DO NOTHING;
