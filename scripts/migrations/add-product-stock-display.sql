-- 상품별 재고 표시 설정 컬럼 추가
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS show_stock      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_gift_stock BOOLEAN NOT NULL DEFAULT true;
