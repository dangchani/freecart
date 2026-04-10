-- Migration: product_quantity_discounts 컬럼 추가 + RLS
ALTER TABLE product_quantity_discounts
  ADD COLUMN IF NOT EXISTS is_active  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE product_quantity_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qty_discounts_select_public" ON product_quantity_discounts;
CREATE POLICY "qty_discounts_select_public" ON product_quantity_discounts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "qty_discounts_modify_admin" ON product_quantity_discounts;
CREATE POLICY "qty_discounts_modify_admin" ON product_quantity_discounts
  FOR ALL USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
