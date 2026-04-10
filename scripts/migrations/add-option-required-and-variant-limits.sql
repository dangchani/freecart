-- Migration: 필수/선택 옵션 + variant별 구매 수량 제한

-- 1) 옵션 필수/선택 구분
ALTER TABLE product_options
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT true;

-- 2) variant별 구매 수량 제한 (NULL = 상품 기본값 따름)
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS min_purchase_quantity INTEGER DEFAULT NULL CHECK (min_purchase_quantity >= 1),
  ADD COLUMN IF NOT EXISTS max_purchase_quantity INTEGER DEFAULT NULL CHECK (max_purchase_quantity >= 1),
  ADD COLUMN IF NOT EXISTS daily_purchase_limit  INTEGER DEFAULT NULL CHECK (daily_purchase_limit >= 1);
