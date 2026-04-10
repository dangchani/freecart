-- =============================================================================
-- Migration: 증정 이벤트 gift_type + 묶음상품 구조
-- =============================================================================

-- 1. product_gift_sets에 gift_type 추가
ALTER TABLE product_gift_sets
  ADD COLUMN IF NOT EXISTS gift_type TEXT NOT NULL DEFAULT 'select'
  CHECK (gift_type IN (
    'select',        -- 고객이 pool에서 직접 선택 (기존)
    'auto_same',     -- 구매 상품과 동일 상품 자동 증정
    'auto_specific'  -- items pool의 특정 상품 자동 증정
  ));

-- 2. products에 product_type 추가
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'single'
  CHECK (product_type IN ('single', 'bundle'));

-- 3. 묶음상품 구성 테이블
CREATE TABLE IF NOT EXISTS bundle_items (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_product_id UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_id        UUID        NOT NULL REFERENCES products(id),
  variant_id        UUID        REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity          INTEGER     NOT NULL CHECK (quantity >= 1),
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle_product_id
  ON bundle_items(bundle_product_id);

CREATE INDEX IF NOT EXISTS idx_bundle_items_product_id
  ON bundle_items(product_id);

-- RLS
ALTER TABLE bundle_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bundle_items_public_read"  ON bundle_items;
DROP POLICY IF EXISTS "bundle_items_admin_all"    ON bundle_items;

CREATE POLICY "bundle_items_public_read" ON bundle_items
  FOR SELECT USING (true);

CREATE POLICY "bundle_items_admin_all" ON bundle_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'super_admin')
    )
  );

-- 4. order_items에 아이템 타입 / 연결 컬럼 추가
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'purchase'
    CHECK (item_type IN (
      'purchase',          -- 일반 구매
      'gift',              -- 자동 증정품
      'bundle_component'   -- 묶음상품 구성 아이템 (재고 차감용)
    )),
  ADD COLUMN IF NOT EXISTS gift_set_id     UUID REFERENCES product_gift_sets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bundle_item_id  UUID REFERENCES bundle_items(id)      ON DELETE SET NULL;
