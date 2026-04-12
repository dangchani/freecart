-- =============================================================================
-- Phase 8: Refund Schema Extension
-- 취소/환불 처리를 위한 DB 보완
-- =============================================================================

-- 1. refunds 테이블 누락 컬럼 추가
ALTER TABLE refunds
  ADD COLUMN IF NOT EXISTS reason_detail   TEXT,
  ADD COLUMN IF NOT EXISTS bank_name       VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_account    VARCHAR(30),
  ADD COLUMN IF NOT EXISTS account_holder  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS images          JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS items           JSONB NOT NULL DEFAULT '[]';

-- type 기본값 수정 (service는 'refund'/'exchange'/'return' 사용)
ALTER TABLE refunds ALTER COLUMN type SET DEFAULT 'refund';

-- 2. coupon_usages 테이블에 user_coupon_id 추가
ALTER TABLE coupon_usages
  ADD COLUMN IF NOT EXISTS user_coupon_id UUID REFERENCES user_coupons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coupon_usages_user_coupon_id ON coupon_usages(user_coupon_id);

-- 3. 재고 복구 RPC (취소/환불 시 사용)
CREATE OR REPLACE FUNCTION increment_variant_stock(p_variant_id UUID, p_quantity INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE product_variants
  SET stock_quantity = stock_quantity + p_quantity
  WHERE id = p_variant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_product_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity + p_quantity
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 쿠폰 사용 횟수 증감 RPC (delta 양수=증가, 음수=감소)
CREATE OR REPLACE FUNCTION increment_coupon_used_count(coupon_id_input UUID, delta INTEGER DEFAULT 1)
RETURNS void AS $$
BEGIN
  UPDATE coupons
  SET used_quantity = GREATEST(0, used_quantity + delta)
  WHERE id = coupon_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 예치금 복구 RPC
CREATE OR REPLACE FUNCTION increment_user_deposit(p_user_id UUID, p_amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET deposit = COALESCE(deposit, 0) + p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
