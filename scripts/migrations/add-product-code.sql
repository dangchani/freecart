-- products 테이블에 자체 상품코드 컬럼 추가
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code VARCHAR(30) UNIQUE;

-- 기존 상품에 상품코드 일괄 부여 (P + 생성일 YYMMDD + 5자리 순번)
WITH numbered AS (
  SELECT id, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY TO_CHAR(created_at, 'YYMMDD')
      ORDER BY created_at, id
    ) AS seq
  FROM products
  WHERE product_code IS NULL
)
UPDATE products p
SET product_code = 'P' || TO_CHAR(n.created_at, 'YYMMDD') || '-' || LPAD(n.seq::text, 5, '0')
FROM numbered n
WHERE p.id = n.id;

-- product_code 자동 생성 트리거 (신규 상품 INSERT 시)
CREATE OR REPLACE FUNCTION generate_product_code()
RETURNS TRIGGER AS $$
DECLARE
  date_part TEXT;
  next_seq  INTEGER;
  new_code  TEXT;
BEGIN
  IF NEW.product_code IS NULL OR NEW.product_code = '' THEN
    date_part := TO_CHAR(NOW(), 'YYMMDD');
    SELECT COALESCE(MAX(
      NULLIF(SPLIT_PART(product_code, '-', 2), '')::integer
    ), 0) + 1
    INTO next_seq
    FROM products
    WHERE product_code LIKE 'P' || date_part || '-%';

    new_code := 'P' || date_part || '-' || LPAD(next_seq::text, 5, '0');
    NEW.product_code := new_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_generate_code ON products;
CREATE TRIGGER trg_products_generate_code
  BEFORE INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION generate_product_code();
