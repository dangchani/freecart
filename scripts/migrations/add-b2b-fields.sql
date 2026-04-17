-- =============================================================================
-- 아임웹 회원 마이그레이션 준비: B2B 커스텀 필드 + 강제 비밀번호 변경 플래그
-- =============================================================================

-- 1. B2B 커스텀 필드 등록 (signup_field_definitions)
--    storage_target = 'custom' → user_field_values 테이블에 저장
INSERT INTO signup_field_definitions (
  field_key, label, field_type, is_required, is_active, sort_order,
  storage_target, storage_column
)
VALUES
  ('company_name',    '상호',        'text', false, true,  9, 'custom', null),
  ('business_number', '사업자번호',  'text', false, true, 10, 'custom', null),
  ('ceo_name',        '대표자명',    'text', false, true, 11, 'custom', null),
  ('business_sector', '종목',        'text', false, true, 12, 'custom', null),
  ('business_type',   '업태',        'text', false, true, 13, 'custom', null)
ON CONFLICT (field_key) DO NOTHING;

-- 2. 강제 비밀번호 변경 플래그
--    아임웹 마이그레이션 회원은 임시 비밀번호로 생성되며,
--    최초 로그인 시 반드시 비밀번호를 변경해야 합니다.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
