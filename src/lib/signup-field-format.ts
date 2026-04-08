// joy: 회원가입 동적 필드 값 포맷/파싱 공통 유틸.
// 회원 목록 / 회원 상세 두 곳에서 재사용.

export interface SignupFieldOption {
  label: string;
  value: string;
}

export interface SignupFieldDef {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  sort_order: number;
  storage_target: 'auth' | 'users' | 'custom';
  storage_column: string | null;
  is_active: boolean;
  options: SignupFieldOption[] | null;
}

/**
 * custom(user_field_values) row 에서 field_type 에 맞는 원시 값을 꺼낸다.
 */
export function extractCustomValue(d: SignupFieldDef, row: any): unknown {
  if (!row) return null;
  if (d.field_type === 'file') return row.value_file_url ?? null;
  if (d.field_type === 'checkbox') return row.value_json ?? null;
  if (d.field_type === 'number') return row.value_number ?? null;
  if (d.field_type === 'date' || d.field_type === 'datetime' || d.field_type === 'time') {
    return row.value_date ?? null;
  }
  return row.value_text ?? null;
}

/**
 * 필드 값을 화면 표시용 문자열로 변환.
 * 이미지/링크가 필요한 파일은 호출측에서 별도 처리.
 */
export function formatSignupFieldValue(d: SignupFieldDef, value: unknown): string {
  if (value == null || value === '') return '-';

  if (d.field_type === 'checkbox') {
    if (d.options && d.options.length > 0) {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      if (arr.length === 0) return '-';
      return arr
        .map((v) => d.options!.find((o) => o.value === v)?.label ?? v)
        .join(', ');
    }
    return value === true || value === 'true' ? '체크' : '해제';
  }

  if (d.field_type === 'radio' || d.field_type === 'select') {
    const opt = d.options?.find((o) => o.value === value);
    return opt?.label ?? String(value);
  }

  if (d.field_type === 'file') {
    return '파일';
  }

  return String(value);
}

/**
 * 정렬 비교용 원시 값 (localeCompare/숫자비교 대상).
 */
export function getSortableValue(d: SignupFieldDef, value: unknown): string | number | null {
  if (value == null || value === '') return null;
  if (d.field_type === 'number') return Number(value);
  if (d.field_type === 'checkbox') {
    if (Array.isArray(value)) return value.join(',');
    return value === true || value === 'true' ? 1 : 0;
  }
  if (d.field_type === 'radio' || d.field_type === 'select') {
    const opt = d.options?.find((o) => o.value === value);
    return opt?.label ?? String(value);
  }
  return String(value);
}
