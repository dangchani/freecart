-- Migration: 사은품 세트 기능 추가
-- 실행 순서: drop-product-gifts.sql → add-product-gift-sets.sql

-- 1) 기존 테이블 제거 (아직 실행 안 했을 경우 대비)
DROP TABLE IF EXISTS product_gifts CASCADE;

-- 2) 사은품 세트
CREATE TABLE IF NOT EXISTS product_gift_sets (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name               VARCHAR(200) NOT NULL,

  -- 'auto'   : 조건 충족 시 풀의 모든 사은품 자동 추가
  -- 'select' : 조건 충족 시 고객이 풀에서 직접 선택
  gift_mode          VARCHAR(10) NOT NULL DEFAULT 'auto'
                     CHECK (gift_mode IN ('auto', 'select')),

  -- 본품을 몇 개 이상 구매해야 발동 (1이면 구매 즉시)
  trigger_quantity   INTEGER     NOT NULL DEFAULT 1 CHECK (trigger_quantity >= 1),

  -- select 모드 전용: 고객이 선택 가능한 총 수량 합계 (auto 모드에서는 무시)
  max_gift_quantity  INTEGER     NOT NULL DEFAULT 1 CHECK (max_gift_quantity >= 1),

  -- select 모드 전용: 선택 가능한 품목 종류 수 (NULL = 제한 없음)
  max_distinct_items INTEGER     CHECK (max_distinct_items >= 1),

  is_active          BOOLEAN     NOT NULL DEFAULT true,
  starts_at          TIMESTAMPTZ,
  ends_at            TIMESTAMPTZ,
  sort_order         INTEGER     NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_gift_sets_product_id
  ON product_gift_sets(product_id);

CREATE TRIGGER trg_product_gift_sets_updated_at
  BEFORE UPDATE ON product_gift_sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3) 사은품 풀 (세트에 속한 선택 가능 상품 목록)
CREATE TABLE IF NOT EXISTS product_gift_set_items (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_set_id     UUID    NOT NULL REFERENCES product_gift_sets(id) ON DELETE CASCADE,
  gift_product_id UUID    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- 이 품목의 최대 선택 수 (NULL = 제한 없음, 1 = 중복 선택 불가)
  max_per_item    INTEGER CHECK (max_per_item >= 1),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gift_set_id, gift_product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_gift_set_items_gift_set_id
  ON product_gift_set_items(gift_set_id);

-- 4) RLS
ALTER TABLE product_gift_sets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_gift_set_items ENABLE ROW LEVEL SECURITY;

-- product_gift_sets: 누구나 조회, 관리자만 수정
DROP POLICY IF EXISTS "gift_sets_select_public"  ON product_gift_sets;
CREATE POLICY "gift_sets_select_public" ON product_gift_sets
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "gift_sets_modify_admin"   ON product_gift_sets;
CREATE POLICY "gift_sets_modify_admin" ON product_gift_sets
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- product_gift_set_items: 누구나 조회, 관리자만 수정
DROP POLICY IF EXISTS "gift_set_items_select_public" ON product_gift_set_items;
CREATE POLICY "gift_set_items_select_public" ON product_gift_set_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "gift_set_items_modify_admin" ON product_gift_set_items;
CREATE POLICY "gift_set_items_modify_admin" ON product_gift_set_items
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
