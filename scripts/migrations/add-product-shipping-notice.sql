-- 상품별 배송/환불 안내 컬럼 추가
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS shipping_notice TEXT,
  ADD COLUMN IF NOT EXISTS return_notice   TEXT;

-- 글로벌 기본 배송/환불 안내 (없으면 INSERT)
INSERT INTO settings (key, value) VALUES
  ('default_shipping_notice', '"배송 기간: 결제 후 1~3 영업일 이내 출고됩니다.\n기본 배송비: 3,000원 (50,000원 이상 구매 시 무료)\n도서·산간 지역은 추가 배송비가 발생할 수 있습니다.11"'),
  ('default_return_notice',   '"교환/반품 신청 기간: 상품 수령 후 7일 이내\n상품 불량·오배송 시: 무료 교환 또는 전액 환불\n단순 변심 반품 시: 왕복 배송비 고객 부담\n사용·세탁·훼손된 상품은 교환/반품이 불가합니다. 11"')
ON CONFLICT (key) DO NOTHING;
