-- 굿스플로 integration_providers 필드 업데이트
-- 운영/테스트 세트로 그룹화 (API Key → 서버 URL → 판매자 코드 순)
UPDATE integration_providers
SET fields = '[
  {"key":"api_key_prod",      "label":"운영 API Key",      "type":"password","required":true},
  {"key":"api_base_prod",     "label":"운영 서버 URL",     "type":"text",    "required":false,"placeholder":"https://api.goodsflow.io","description":"비워두면 기본값 사용"},
  {"key":"seller_code_prod",  "label":"운영 판매자 코드",  "type":"text",    "required":false,"placeholder":"코드 조회 버튼으로 선택"},
  {"key":"api_key_test",      "label":"테스트 API Key",    "type":"password","required":false},
  {"key":"api_base_test",     "label":"테스트 서버 URL",   "type":"text",    "required":false,"placeholder":"https://test-api.goodsflow.io","description":"비워두면 기본값 사용"},
  {"key":"seller_code_test",  "label":"테스트 판매자 코드","type":"text",    "required":false,"placeholder":"코드 조회 버튼으로 선택"},
  {"key":"use_test",          "label":"테스트 모드",       "type":"toggle",  "required":false,"description":"송장 발급 시 테스트 API Key/서버 사용"}
]'::jsonb
WHERE key = 'goodsflow';

-- 기존 external_connections 데이터 마이그레이션
-- api_key → api_key_prod 로 이전 (기존 값이 있고 api_key_prod가 없는 경우)
UPDATE external_connections
SET credentials = credentials
  - 'api_key'
  || jsonb_build_object('api_key_prod', credentials->>'api_key')
WHERE platform = 'goodsflow'
  AND credentials ? 'api_key'
  AND NOT (credentials ? 'api_key_prod');
