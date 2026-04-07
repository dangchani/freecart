// joy: 회원가입 동적 필드 공용 타입
export type FieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'password'
  | 'url'
  | 'phone'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'time'
  | 'datetime'
  | 'address'
  | 'file';

export type StorageTarget = 'auth' | 'users' | 'custom';

export interface FieldDefinition {
  id: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  placeholder: string | null;
  help_text: string | null;
  validation_rule: Record<string, unknown> | null;
  default_value: string | null;
  options: Array<{ label: string; value: string }> | null;
  target_role: string;
  is_system: boolean;
  storage_target: StorageTarget;
  storage_column: string | null;
}

// 필드 값(입력 상태) — 타입별로 다양한 형태 가능
export type FieldValue = string | number | boolean | string[] | File | AddressValue | null;

export interface AddressValue {
  zonecode: string;
  address: string;
  detailAddress: string;
}

export type FieldValueMap = Record<string, FieldValue>;

// email/password/name/phone은 비활성화/삭제 모두 불가 (회원가입 기본 필드)
export function isCoreField(fieldKey: string): boolean {
  return fieldKey === 'email' || fieldKey === 'password' || fieldKey === 'name' || fieldKey === 'phone';
}
