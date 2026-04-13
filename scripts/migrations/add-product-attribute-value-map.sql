-- 상품↔속성값 매핑 테이블 추가
-- product_attribute_values 는 속성값 마스터이며 상품과의 연결 테이블이 없었음.
-- 이 마이그레이션으로 상품별 속성값 지정 및 속성 필터 기능을 활성화함.

CREATE TABLE IF NOT EXISTS product_attribute_value_map (
  product_id         UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute_value_id UUID NOT NULL REFERENCES product_attribute_values(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, attribute_value_id)
);

CREATE INDEX IF NOT EXISTS idx_product_attr_value_map_product
  ON product_attribute_value_map(product_id);

CREATE INDEX IF NOT EXISTS idx_product_attr_value_map_value
  ON product_attribute_value_map(attribute_value_id);

-- RLS: 공개 읽기 / 관리자 전체
ALTER TABLE product_attribute_value_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_attr_value_map_public_read" ON product_attribute_value_map;
CREATE POLICY "product_attr_value_map_public_read"
  ON product_attribute_value_map FOR SELECT USING (true);

DROP POLICY IF EXISTS "product_attr_value_map_admin_all" ON product_attribute_value_map;
CREATE POLICY "product_attr_value_map_admin_all"
  ON product_attribute_value_map FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
