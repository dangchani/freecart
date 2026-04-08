-- Migration: signup_field_definitions 테이블에 terms 타입 및 terms_id 추가
-- 기존 DB에 적용하는 경우 이 파일을 실행하세요.

-- 1) field_type CHECK 제약조건에 'terms' 추가
ALTER TABLE signup_field_definitions
  DROP CONSTRAINT IF EXISTS signup_field_definitions_field_type_check;

ALTER TABLE signup_field_definitions
  ADD CONSTRAINT signup_field_definitions_field_type_check
    CHECK (field_type IN (
      'text', 'textarea',
      'select', 'radio', 'checkbox',
      'url', 'phone',
      'date', 'time', 'datetime',
      'address', 'file', 'number', 'email',
      'terms'
    ));

-- 2) terms_id 컬럼 추가
ALTER TABLE signup_field_definitions
  ADD COLUMN IF NOT EXISTS terms_id UUID REFERENCES terms(id) ON DELETE SET NULL;

