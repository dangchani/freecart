-- Phase 1: 주문 검색 고도화 — 상품명 검색용 RPC
-- 실행 대상: 기존 운영 DB (신규 DB는 db-schema-full.sql에 포함됨)

-- 상품명/옵션명으로 주문 ID 목록을 반환하는 함수
CREATE OR REPLACE FUNCTION public.search_orders_by_product(keyword TEXT)
RETURNS TABLE(order_id UUID) AS $$
  SELECT DISTINCT oi.order_id
  FROM order_items oi
  WHERE oi.product_name ILIKE '%' || keyword || '%'
     OR oi.option_text ILIKE '%' || keyword || '%';
$$ LANGUAGE sql SECURITY DEFINER;
