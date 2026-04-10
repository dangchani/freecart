-- Migration: 기존 product_gifts 테이블 제거
-- 기존 product_gifts는 DB 컬럼과 서비스 코드가 전혀 일치하지 않아 한 번도 정상 동작한 적 없는 미완성 테이블.
-- product_gift_sets / product_gift_set_items 으로 완전 교체한다.

DROP TABLE IF EXISTS product_gifts CASCADE;
