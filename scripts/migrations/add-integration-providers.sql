-- 외부 연동 서비스 카탈로그 테이블
CREATE TABLE IF NOT EXISTS integration_providers (
  key          VARCHAR(30)  PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  category     VARCHAR(50)  NOT NULL,
  description  TEXT,
  fields       JSONB        NOT NULL DEFAULT '[]',
  has_test     BOOLEAN      NOT NULL DEFAULT false,
  sort_order   INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 초기 서비스 데이터
INSERT INTO integration_providers (key, name, category, description, fields, has_test, sort_order) VALUES
(
  'goodsflow',
  '굿스플로',
  '물류/배송',
  '택배 발송 및 운송장 자동 채번 서비스',
  '[{"key":"api_key_prod","label":"운영 API Key","type":"password","required":true},{"key":"api_base_prod","label":"운영 서버 URL","type":"text","required":false,"placeholder":"https://api.goodsflow.io","description":"비워두면 기본값 사용"},{"key":"seller_code_prod","label":"운영 판매자 코드","type":"text","required":false,"placeholder":"코드 조회 버튼으로 선택"},{"key":"api_key_test","label":"테스트 API Key","type":"password","required":false},{"key":"api_base_test","label":"테스트 서버 URL","type":"text","required":false,"placeholder":"https://test-api.goodsflow.io","description":"비워두면 기본값 사용"},{"key":"seller_code_test","label":"테스트 판매자 코드","type":"text","required":false,"placeholder":"코드 조회 버튼으로 선택"},{"key":"use_test","label":"테스트 모드","type":"toggle","required":false,"description":"송장 발급 시 테스트 API Key/서버 사용"}]'::jsonb,
  true, 1
),
(
  'ecount',
  '이카운트',
  'ERP',
  '재고·매출 ERP 연동 서비스',
  '[
    {"key":"company_code", "label":"회사코드",   "type":"text",     "required":true},
    {"key":"user_id",      "label":"사용자 ID",  "type":"text",     "required":true},
    {"key":"api_key",      "label":"API Key",    "type":"password", "required":true}
  ]'::jsonb,
  true, 2
),
(
  'ppurio',
  '뿌리오',
  '문자/알림',
  '문자 메시지(SMS/LMS/MMS) 발송 서비스',
  '[
    {"key":"api_key",      "label":"API Key",  "type":"password", "required":true},
    {"key":"sender_phone", "label":"발신번호", "type":"text",     "required":true,  "placeholder":"010-0000-0000"}
  ]'::jsonb,
  true, 3
),
(
  'popbill',
  '팝빌',
  '문자/알림',
  '세금계산서·문자 통합 서비스',
  '[
    {"key":"link_id",         "label":"링크 ID",    "type":"text",     "required":true},
    {"key":"secret_key",      "label":"Secret Key", "type":"password", "required":true},
    {"key":"business_number", "label":"사업자번호", "type":"text",     "required":true, "placeholder":"000-00-00000"}
  ]'::jsonb,
  true, 4
)
ON CONFLICT (key) DO NOTHING;

-- external_connections.platform 유니크 제약 추가 (서비스당 1개)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_external_connections_platform'
  ) THEN
    ALTER TABLE external_connections
      ADD CONSTRAINT uq_external_connections_platform UNIQUE (platform);
  END IF;
END $$;
