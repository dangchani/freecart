-- =============================================================================
-- Admin Return/Exchange v2: 관리자 반품/교환 기능을 위한 스키마 확장
-- 실행 대상: 기존 DB (데이터 보존)
-- =============================================================================

-- ── 1. returns 테이블 ────────────────────────────────────────────────────────

-- 1-1. 새 컬럼 추가
ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS items            JSONB,
  ADD COLUMN IF NOT EXISTS refund_amount    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_method    VARCHAR(30),
  ADD COLUMN IF NOT EXISTS bank_name        VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_account     VARCHAR(30),
  ADD COLUMN IF NOT EXISTS account_holder   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS initiated_by     VARCHAR(20) NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS processed_at     TIMESTAMPTZ;

-- 1-2. 기존 item_ids → items 데이터 변환 (quantity 1로 초기화)
--      [{order_item_id: "uuid", quantity: 1}]
UPDATE returns
SET items = (
  SELECT jsonb_agg(jsonb_build_object('order_item_id', elem::text, 'quantity', 1))
  FROM jsonb_array_elements_text(item_ids) AS elem
)
WHERE items IS NULL
  AND item_ids IS NOT NULL
  AND jsonb_array_length(item_ids) > 0;

-- 빈 배열이거나 NULL인 경우 빈 배열로 초기화
UPDATE returns SET items = '[]'::jsonb WHERE items IS NULL;

-- 1-3. NOT NULL + DEFAULT 설정
ALTER TABLE returns ALTER COLUMN items SET NOT NULL;
ALTER TABLE returns ALTER COLUMN items SET DEFAULT '[]';

-- 1-4. 기존 item_ids 컬럼 삭제
ALTER TABLE returns DROP COLUMN IF EXISTS item_ids;

-- ── 2. exchanges 테이블 ──────────────────────────────────────────────────────

-- 2-1. 새 컬럼 추가
ALTER TABLE exchanges
  ADD COLUMN IF NOT EXISTS items          JSONB,
  ADD COLUMN IF NOT EXISTS price_diff     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS initiated_by   VARCHAR(20) NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS processed_at   TIMESTAMPTZ;

-- 2-2. 기존 item_ids + exchange_variant_id → items 데이터 변환
--      [{order_item_id: "uuid", quantity: 1, exchange_variant_id: "uuid or empty"}]
UPDATE exchanges
SET items = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'order_item_id',       elem::text,
      'quantity',            1,
      'exchange_variant_id', COALESCE(exchange_variant_id::text, '')
    )
  )
  FROM jsonb_array_elements_text(item_ids) AS elem
)
WHERE items IS NULL
  AND item_ids IS NOT NULL
  AND jsonb_array_length(item_ids) > 0;

UPDATE exchanges SET items = '[]'::jsonb WHERE items IS NULL;

-- 2-3. NOT NULL + DEFAULT 설정
ALTER TABLE exchanges ALTER COLUMN items SET NOT NULL;
ALTER TABLE exchanges ALTER COLUMN items SET DEFAULT '[]';

-- 2-4. 기존 컬럼 삭제
ALTER TABLE exchanges DROP COLUMN IF EXISTS item_ids;
ALTER TABLE exchanges DROP COLUMN IF EXISTS exchange_variant_id;

-- ── 3. orders 테이블 ─────────────────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS returned_amount INTEGER NOT NULL DEFAULT 0;

-- ── 4. order_items 테이블 ────────────────────────────────────────────────────

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS returned_quantity  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exchanged_quantity INTEGER NOT NULL DEFAULT 0;

-- ── 5. cash_receipts 테이블 ──────────────────────────────────────────────────

ALTER TABLE cash_receipts
  ADD COLUMN IF NOT EXISTS original_receipt_id UUID REFERENCES cash_receipts(id) ON DELETE SET NULL;

-- ── 6. tax_invoices 테이블 ───────────────────────────────────────────────────

ALTER TABLE tax_invoices
  ADD COLUMN IF NOT EXISTS original_invoice_id UUID REFERENCES tax_invoices(id) ON DELETE SET NULL;
