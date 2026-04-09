-- Migration: signup_field_definitions에 마이페이지 수정 가능 여부 컬럼 추가

ALTER TABLE signup_field_definitions
  ADD COLUMN IF NOT EXISTS is_editable BOOLEAN NOT NULL DEFAULT true;

-- login_id는 절대 변경 불가
UPDATE signup_field_definitions SET is_editable = false WHERE field_key = 'login_id';
