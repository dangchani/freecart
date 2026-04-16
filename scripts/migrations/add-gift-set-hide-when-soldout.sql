-- 사은품 세트: 모든 사은품 품절 시 자동 숨김 옵션 컬럼 추가
ALTER TABLE product_gift_sets
  ADD COLUMN IF NOT EXISTS hide_when_soldout BOOLEAN NOT NULL DEFAULT false;

-- 기존 묶음상품(bundle) stock_quantity를 실효 재고로 일괄 동기화
-- (bundle_items가 있는 경우에만, 없으면 0 유지)
UPDATE products p
SET stock_quantity = COALESCE((
  SELECT MIN(
    FLOOR(
      CASE WHEN comp.has_options THEN
        COALESCE((
          SELECT SUM(v.stock_quantity)
          FROM product_variants v
          WHERE v.product_id = comp.id AND v.is_active = true
        ), 0)
      ELSE
        comp.stock_quantity
      END
      / bi.quantity::float
    )
  )
  FROM bundle_items bi
  JOIN products comp ON comp.id = bi.product_id
  WHERE bi.bundle_product_id = p.id
), 0)
WHERE p.product_type = 'bundle';
