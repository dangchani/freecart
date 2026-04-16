-- gf_centers: 출고지 목록 캐시 (외부 연동 페이지에서 동기화 버튼으로 저장)
INSERT INTO system_settings (key, value, description)
VALUES ('gf_centers', '[]', '굿스플로 출고지 목록 (외부 연동 페이지에서 동기화)')
ON CONFLICT (key) DO NOTHING;
