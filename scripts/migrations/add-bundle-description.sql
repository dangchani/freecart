-- =============================================================================
-- Migration: 세트상품 구성 설명란 추가
-- products 테이블에 bundle_description 컬럼 추가
-- =============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS bundle_description TEXT;
