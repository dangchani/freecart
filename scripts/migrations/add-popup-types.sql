-- Migration: popups 테이블 타입 확장 + popup_images 테이블 추가

-- 1) popup_type 컬럼 추가
ALTER TABLE popups
  ADD COLUMN IF NOT EXISTS popup_type VARCHAR(20) NOT NULL DEFAULT 'image';

ALTER TABLE popups
  DROP CONSTRAINT IF EXISTS popups_popup_type_check;
ALTER TABLE popups
  ADD CONSTRAINT popups_popup_type_check
    CHECK (popup_type IN ('text', 'image', 'slide'));

-- 2) 슬라이드 설정 컬럼 추가
ALTER TABLE popups
  ADD COLUMN IF NOT EXISTS slide_settings JSONB;

-- 3) 커스텀 좌표 컬럼 추가
ALTER TABLE popups
  ADD COLUMN IF NOT EXISTS position_x NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS position_y NUMERIC(5,2);

-- 4) position CHECK 제약 확장 ('custom' 추가)
ALTER TABLE popups
  DROP CONSTRAINT IF EXISTS popups_position_check;
ALTER TABLE popups
  ADD CONSTRAINT popups_position_check
    CHECK (position IN ('center','top','bottom','left','right','custom'));

-- 5) popup_images 테이블 생성
CREATE TABLE IF NOT EXISTS popup_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  popup_id    UUID NOT NULL REFERENCES popups(id) ON DELETE CASCADE,
  image_url   VARCHAR(500) NOT NULL,
  link_url    VARCHAR(500),
  caption     VARCHAR(200),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_popup_images_popup_id ON popup_images(popup_id);
