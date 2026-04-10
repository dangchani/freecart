-- Migration: 사은품 세트 기능 추가 (tier 기반 재설계)
-- 실행 순서: drop-product-gifts.sql → add-product-gift-sets.sql

-- 1) 기존 테이블 제거
DROP TABLE IF EXISTS product_gift_set_items CASCADE;
DROP TABLE IF EXISTS product_gift_tiers CASCADE;
DROP TABLE IF EXISTS product_gift_sets CASCADE;
DROP TABLE IF EXISTS product_gifts CASCADE;

-- 2) 사은품 세트
CREATE TABLE IF NOT EXISTS product_gift_sets (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID         NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_gift_sets_product_id
  ON product_gift_sets(product_id);

CREATE TRIGGER trg_product_gift_sets_updated_at
  BEFORE UPDATE ON product_gift_sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3) 사은품 구간 (tier)
--    min_quantity 이상 구매 시 free_count 개 선택 가능
--    구매수량에 해당하는 tier 중 min_quantity가 가장 큰 tier를 적용
CREATE TABLE IF NOT EXISTS product_gift_tiers (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_set_id   UUID    NOT NULL REFERENCES product_gift_sets(id) ON DELETE CASCADE,
  min_quantity  INTEGER NOT NULL CHECK (min_quantity >= 1),
  free_count    INTEGER NOT NULL CHECK (free_count >= 1),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_gift_tiers_gift_set_id
  ON product_gift_tiers(gift_set_id);

-- 4) 사은품 풀 (세트에 속한 선택 가능 상품 목록)
CREATE TABLE IF NOT EXISTS product_gift_set_items (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_set_id     UUID    NOT NULL REFERENCES product_gift_sets(id) ON DELETE CASCADE,
  gift_product_id UUID    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gift_set_id, gift_product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_gift_set_items_gift_set_id
  ON product_gift_set_items(gift_set_id);

-- 5) RLS
ALTER TABLE product_gift_sets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_gift_tiers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_gift_set_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gift_sets_select_public"  ON product_gift_sets;
CREATE POLICY "gift_sets_select_public" ON product_gift_sets
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "gift_sets_modify_admin" ON product_gift_sets;
CREATE POLICY "gift_sets_modify_admin" ON product_gift_sets
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "gift_tiers_select_public" ON product_gift_tiers;
CREATE POLICY "gift_tiers_select_public" ON product_gift_tiers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "gift_tiers_modify_admin" ON product_gift_tiers;
CREATE POLICY "gift_tiers_modify_admin" ON product_gift_tiers
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "gift_set_items_select_public" ON product_gift_set_items;
CREATE POLICY "gift_set_items_select_public" ON product_gift_set_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "gift_set_items_modify_admin" ON product_gift_set_items;
CREATE POLICY "gift_set_items_modify_admin" ON product_gift_set_items
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
