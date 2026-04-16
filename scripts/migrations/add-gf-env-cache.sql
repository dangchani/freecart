-- 굿스플로 운영/테스트 분리 캐시 키 추가
INSERT INTO system_settings (key, value, description) VALUES
  ('gf_centers_prod',   '[]', '굿스플로 운영 출고지 목록'),
  ('gf_centers_test',   '[]', '굿스플로 테스트 출고지 목록'),
  ('gf_contracts_prod', '[]', '굿스플로 운영 계약 목록 (APPROVED)'),
  ('gf_contracts_test', '[]', '굿스플로 테스트 계약 목록 (APPROVED)')
ON CONFLICT (key) DO NOTHING;
