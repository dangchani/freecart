-- Migration: menus 테이블에 menu_type, category_id, board_id, is_system 추가
-- 기존 DB에 적용하는 경우 이 파일을 실행하세요.

ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS menu_type   VARCHAR(20) NOT NULL DEFAULT 'link',
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES product_categories(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS board_id    UUID REFERENCES boards(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_system   BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_menus_category_id ON menus(category_id);
CREATE INDEX IF NOT EXISTS idx_menus_board_id    ON menus(board_id);

-- 기존 레코드는 모두 'link' 타입으로 유지

-- 시스템 고정 메뉴 항목 삽입 (없을 때만)
INSERT INTO menus (menu_type, name, is_system, is_visible, sort_order, position)
SELECT 'notice',      '공지사항', true, true, 100, 'header'
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_type = 'notice' AND is_system = true);

INSERT INTO menus (menu_type, name, is_system, is_visible, sort_order, position)
SELECT 'faq',         'FAQ',      true, true, 110, 'header'
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_type = 'faq' AND is_system = true);

INSERT INTO menus (menu_type, name, is_system, is_visible, sort_order, position)
SELECT 'inquiry',     '1:1 문의', true, true, 120, 'header'
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_type = 'inquiry' AND is_system = true);

INSERT INTO menus (menu_type, name, is_system, is_visible, sort_order, position)
SELECT 'product_qna', '상품 Q&A', true, true, 130, 'header'
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_type = 'product_qna' AND is_system = true);

INSERT INTO menus (menu_type, name, is_system, is_visible, sort_order, position)
SELECT 'review',      '리뷰',     true, true, 140, 'header'
WHERE NOT EXISTS (SELECT 1 FROM menus WHERE menu_type = 'review' AND is_system = true);
