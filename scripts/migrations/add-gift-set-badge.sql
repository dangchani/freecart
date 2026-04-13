-- joy: 사은품 세트 썸네일 띠지 기능 추가
--   product_gift_sets 테이블에 띠지 관련 컬럼 추가
--   badge_text  : 썸네일 하단에 표시할 띠지 텍스트 (예: "3+1", "기획전", "증정")
--   badge_color : 띠지 배경색 키 (red | yellow | green | blue | purple)

ALTER TABLE product_gift_sets
  ADD COLUMN IF NOT EXISTS badge_text  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS badge_color VARCHAR(20) DEFAULT 'red';

COMMENT ON COLUMN product_gift_sets.badge_text  IS '상품 썸네일 하단 띠지 텍스트 (예: 3+1, 기획전). NULL이면 띠지 미표시';
COMMENT ON COLUMN product_gift_sets.badge_color IS '띠지 배경색 키: red | yellow | green | blue | purple (기본값: red)';
