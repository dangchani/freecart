-- Migration: 상품별 1일 최대 구매 수량 설정 추가

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS daily_purchase_limit INTEGER DEFAULT NULL;

COMMENT ON COLUMN products.daily_purchase_limit IS
  '1인당 하루 최대 구매 가능 수량. NULL이면 제한 없음';
