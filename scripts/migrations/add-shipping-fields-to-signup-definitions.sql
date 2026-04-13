-- joy: 배송지 폼 필드 관리 기능 추가
--   1) signup_field_definitions: 배송지 관련 컬럼 추가
--      use_in_shipping      : 해당 필드를 배송지 폼에 포함할지 여부
--      shipping_sort_order  : 배송지 폼에서의 표시 순서
--      shipping_is_required : 배송지 폼에서의 필수 여부 (회원가입 is_required와 별개)
--   2) orders: 동적 배송지 필드 값 저장용 컬럼 추가
--      extra_shipping_fields: 주문 시 입력된 동적 배송지 필드 값 (JSONB)

-- 1) signup_field_definitions 컬럼 추가
ALTER TABLE signup_field_definitions
  ADD COLUMN IF NOT EXISTS use_in_shipping      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_sort_order  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_is_required BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN signup_field_definitions.use_in_shipping      IS '배송지 폼(주문/마이페이지)에서 이 필드를 표시할지 여부';
COMMENT ON COLUMN signup_field_definitions.shipping_sort_order  IS '배송지 폼에서의 표시 순서 (낮을수록 위에 표시)';
COMMENT ON COLUMN signup_field_definitions.shipping_is_required IS '배송지 폼에서의 필수 입력 여부 (회원가입 is_required와 별개)';

-- 2) orders 컬럼 추가
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS extra_shipping_fields JSONB;

COMMENT ON COLUMN orders.extra_shipping_fields IS '주문 시 동적 배송지 폼에서 입력된 추가 필드 값 ({"field_key": "value", ...})';
