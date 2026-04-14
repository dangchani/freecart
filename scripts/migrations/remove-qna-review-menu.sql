-- menus 테이블에서 불필요한 시스템 메뉴 제거
-- - 상품 Q&A, 리뷰: 상품 상세 페이지 탭에서 처리
-- - 1:1 문의: 마이페이지에서 처리 (로그인 사용자 전용)

DELETE FROM menus WHERE menu_type = 'product_qna' AND is_system = true;
DELETE FROM menus WHERE menu_type = 'review' AND is_system = true;
DELETE FROM menus WHERE menu_type = 'inquiry' AND is_system = true;
