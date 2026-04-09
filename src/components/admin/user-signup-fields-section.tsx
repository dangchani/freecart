// joy: 회원 상세에 표시할 동적 회원가입 필드 섹션
// signup_field_definitions의 활성 필드(기본 4개 제외)를 storage_target에 따라 값 조회 후 렌더
// editing=true 인 경우 타입별 입력 UI 제공. 부모가 ref로 save()를 호출해 일괄 저장.
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logAdminAction, buildDiff } from '@/lib/admin-log';
import { openDaumPostcode } from '@/lib/daum-postcode';
import { uploadSignupFile } from '@/lib/upload-signup-file';

// 기본 정보 카드에서 이미 표시되는 필드 (아이디/이메일/이름/휴대폰/가입일)
// password는 절대 노출 금지
const EXCLUDED_KEYS = new Set(['email', 'password', 'name', 'phone', 'login_id']);

interface FieldOption {
  label: string;
  value: string;
}

interface FieldDef {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  sort_order: number;
  storage_target: 'auth' | 'users' | 'custom';
  storage_column: string | null;
  is_active: boolean;
  options: FieldOption[] | null;
}

interface AddressValue {
  postal_code: string;
  address1: string;
  address2: string;
}

// draft 타입: 필드 타입별로 다르지만 내부적으로 문자열/배열/객체/파일을 모두 담는다.
type DraftValue = string | string[] | boolean | AddressValue | File | null;

interface LoadedField {
  def: FieldDef;
  original: DraftValue;
  draft: DraftValue;
  // custom 필드의 file 타입 저장용 (저장된 URL)
  fileUrl?: string | null;
}

export interface UserSignupFieldsSectionHandle {
  save: () => Promise<boolean>;
  hasChanges: () => boolean;
}

interface Props {
  userId: string;
  editing?: boolean;
}

// custom 타입의 값 컬럼 판별
function customValueColumn(
  fieldType: string,
): 'value_text' | 'value_number' | 'value_date' | 'value_json' {
  if (fieldType === 'number') return 'value_number';
  if (fieldType === 'date' || fieldType === 'datetime' || fieldType === 'time') return 'value_date';
  if (fieldType === 'checkbox') return 'value_json';
  return 'value_text';
}

// 값 비교 (배열/객체 포함)
function isEqual(a: DraftValue, b: DraftValue): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (a instanceof File || b instanceof File) return false; // 파일은 교체 시 항상 변경
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

// 화면 표시용 포맷
function formatForDisplay(d: FieldDef, value: DraftValue, fileUrl?: string | null): React.ReactNode {
  if (d.field_type === 'file') {
    if (fileUrl) {
      return (
        <a href={fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
          파일 다운로드
        </a>
      );
    }
    return '-';
  }
  if (d.field_type === 'address') {
    const a = value as AddressValue | null;
    if (!a || (!a.postal_code && !a.address1)) return '-';
    return [a.postal_code ? `(${a.postal_code})` : '', a.address1, a.address2]
      .filter(Boolean)
      .join(' ');
  }
  if (d.field_type === 'checkbox') {
    // options 가 있으면 배열 (선택한 항목들), 없으면 단일 boolean
    if (d.options && d.options.length > 0) {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      if (arr.length === 0) return '-';
      const labels = arr.map(
        (v) => d.options!.find((o) => o.value === v)?.label ?? v,
      );
      return labels.join(', ');
    }
    return value === true || value === 'true' ? '체크' : '해제';
  }
  if (d.field_type === 'radio' || d.field_type === 'select') {
    if (value == null || value === '') return '-';
    const opt = d.options?.find((o) => o.value === value);
    return opt?.label ?? String(value);
  }
  if (value == null || value === '') return '-';
  return String(value);
}

// 로그에 남길 직렬화 값 (파일은 이름만, 주소는 합친 문자열)
function serializeForLog(d: FieldDef, value: DraftValue, fileUrl?: string | null): unknown {
  if (d.field_type === 'file') {
    if (value instanceof File) return { uploaded: value.name };
    return fileUrl ?? null;
  }
  if (d.field_type === 'address') {
    const a = value as AddressValue | null;
    if (!a) return null;
    return `${a.postal_code ?? ''} ${a.address1 ?? ''} ${a.address2 ?? ''}`.trim();
  }
  if (Array.isArray(value)) return value;
  if (typeof value === 'object' && value !== null) return value;
  return value;
}

export const UserSignupFieldsSection = forwardRef<UserSignupFieldsSectionHandle, Props>(
  function UserSignupFieldsSection({ userId, editing = false }, ref) {
    const supabase = createClient();
    const [fields, setFields] = useState<LoadedField[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      loadFields();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    async function loadFields() {
      setLoading(true);

      const { data: defsData } = await supabase
        .from('signup_field_definitions')
        .select('id, field_key, label, field_type, sort_order, storage_target, storage_column, is_active, options')
        .eq('is_active', true)
        .order('sort_order');
      const defs = ((defsData as FieldDef[]) ?? []).filter(
        (d) => !EXCLUDED_KEYS.has(d.field_key) && d.storage_target !== 'auth',
      );

      if (defs.length === 0) {
        setFields([]);
        setLoading(false);
        return;
      }

      // users 컬럼 일괄 조회
      const userColumns = defs
        .filter((d) => d.storage_target === 'users' && d.storage_column)
        .map((d) => d.storage_column as string);
      let userRow: Record<string, unknown> = {};
      if (userColumns.length > 0) {
        const { data } = await supabase
          .from('users')
          .select(userColumns.join(','))
          .eq('id', userId)
          .single();
        userRow = (data as unknown as Record<string, unknown>) ?? {};
      }

      // 주소 (user_addresses 기본 배송지)
      const hasAddress = defs.some((d) => d.field_type === 'address');
      let addressValue: AddressValue | null = null;
      if (hasAddress) {
        const { data: addr } = await supabase
          .from('user_addresses')
          .select('postal_code, address1, address2')
          .eq('user_id', userId)
          .eq('is_default', true)
          .maybeSingle();
        if (addr) {
          addressValue = {
            postal_code: addr.postal_code ?? '',
            address1: addr.address1 ?? '',
            address2: addr.address2 ?? '',
          };
        }
      }

      // custom 값 조회
      const customDefIds = defs.filter((d) => d.storage_target === 'custom').map((d) => d.id);
      const customMap = new Map<string, any>();
      if (customDefIds.length > 0) {
        const { data: customData } = await supabase
          .from('user_field_values')
          .select('field_definition_id, value_text, value_number, value_date, value_json, value_file_url')
          .eq('user_id', userId)
          .in('field_definition_id', customDefIds);
        for (const row of customData ?? []) {
          customMap.set((row as any).field_definition_id, row);
        }
      }

      const loaded: LoadedField[] = defs.map((d) => {
        let value: DraftValue = '';
        let fileUrl: string | null = null;

        if (d.field_type === 'address') {
          value = addressValue;
        } else if (d.storage_target === 'users' && d.storage_column) {
          const raw = userRow[d.storage_column];
          if (d.field_type === 'checkbox') {
            if (d.options && d.options.length > 0) {
              value = Array.isArray(raw) ? (raw as string[]) : [];
            } else {
              value = raw === true || raw === 'true';
            }
          } else if (raw != null) {
            value = String(raw);
          }
        } else if (d.storage_target === 'custom') {
          const row = customMap.get(d.id);
          if (row) {
            fileUrl = row.value_file_url ?? null;
            if (d.field_type === 'file') {
              value = null; // file 타입은 draft=File, original은 URL로 fileUrl 사용
            } else if (d.field_type === 'checkbox') {
              if (d.options && d.options.length > 0) {
                const j = row.value_json;
                value = Array.isArray(j) ? j : [];
              } else {
                value = row.value_json === true;
              }
            } else {
              const col = customValueColumn(d.field_type);
              const raw = row[col];
              if (raw != null) {
                value = col === 'value_json' ? JSON.stringify(raw) : String(raw);
              }
            }
          } else if (d.field_type === 'checkbox' && d.options && d.options.length > 0) {
            value = [];
          } else if (d.field_type === 'checkbox') {
            value = false;
          }
        }

        return { def: d, original: value, draft: value, fileUrl };
      });

      setFields(loaded);
      setLoading(false);
    }

    // 편집 모드 종료 시 draft를 original로 리셋 (취소 처리)
    useEffect(() => {
      if (!editing) {
        setFields((prev) => prev.map((f) => ({ ...f, draft: f.original })));
      }
    }, [editing]);

    useImperativeHandle(
      ref,
      () => ({
        hasChanges: () => fields.some((f) => !isEqual(f.draft, f.original)),
        save: async () => {
          const changed = fields.filter((f) => !isEqual(f.draft, f.original));
          if (changed.length === 0) return true;

          try {
            // 1) users 테이블 일괄 update
            const userUpdates: Record<string, unknown> = {};
            for (const f of changed) {
              if (f.def.storage_target === 'users' && f.def.storage_column && f.def.field_type !== 'address') {
                const v = f.draft;
                if (f.def.field_type === 'checkbox') {
                  userUpdates[f.def.storage_column] = v;
                } else if (v === '' || v == null) {
                  userUpdates[f.def.storage_column] = null;
                } else {
                  userUpdates[f.def.storage_column] = v;
                }
              }
            }
            if (Object.keys(userUpdates).length > 0) {
              const { error } = await supabase.from('users').update(userUpdates).eq('id', userId);
              if (error) throw error;
            }

            // 2) 주소 upsert (user_addresses 기본 배송지)
            const addressChanged = changed.find((f) => f.def.field_type === 'address');
            if (addressChanged) {
              const a = addressChanged.draft as AddressValue | null;
              if (a && (a.postal_code || a.address1)) {
                // 기존 기본 배송지 조회
                const { data: existing } = await supabase
                  .from('user_addresses')
                  .select('id')
                  .eq('user_id', userId)
                  .eq('is_default', true)
                  .maybeSingle();
                if (existing) {
                  const { error } = await supabase
                    .from('user_addresses')
                    .update({
                      postal_code: a.postal_code,
                      address1: a.address1,
                      address2: a.address2,
                    })
                    .eq('id', existing.id);
                  if (error) throw error;
                } else {
                  // name/phone 가져와서 insert
                  const { data: u } = await supabase
                    .from('users')
                    .select('name, phone')
                    .eq('id', userId)
                    .single();
                  const { error } = await supabase.from('user_addresses').insert({
                    user_id: userId,
                    name: '기본 배송지',
                    recipient_name: u?.name || '회원',
                    recipient_phone: u?.phone || '-',
                    postal_code: a.postal_code,
                    address1: a.address1,
                    address2: a.address2 || null,
                    is_default: true,
                  });
                  if (error) throw error;
                }
              }
            }

            // 3) custom 필드 upsert
            for (const f of changed) {
              if (f.def.storage_target !== 'custom') continue;

              // file 타입: 업로드 후 URL 저장
              if (f.def.field_type === 'file') {
                if (f.draft instanceof File) {
                  const url = await uploadSignupFile(userId, f.def.field_key, f.draft);
                  const { error } = await supabase
                    .from('user_field_values')
                    .upsert(
                      {
                        user_id: userId,
                        field_definition_id: f.def.id,
                        value_file_url: url,
                      },
                      { onConflict: 'user_id,field_definition_id' },
                    );
                  if (error) throw error;
                  f.fileUrl = url;
                }
                continue;
              }

              const payload: Record<string, unknown> = {
                user_id: userId,
                field_definition_id: f.def.id,
                value_text: null,
                value_number: null,
                value_date: null,
                value_json: null,
              };

              if (f.def.field_type === 'checkbox') {
                payload.value_json = f.draft;
              } else {
                const col = customValueColumn(f.def.field_type);
                const v = f.draft;
                if (v !== '' && v != null) {
                  if (col === 'value_number') payload[col] = Number(v as string);
                  else payload[col] = v;
                }
              }

              const { error } = await supabase
                .from('user_field_values')
                .upsert(payload, { onConflict: 'user_id,field_definition_id' });
              if (error) throw error;
            }

            // 4) 로그 기록 (필드별 diff)
            const before: Record<string, unknown> = {};
            const after: Record<string, unknown> = {};
            for (const f of changed) {
              before[f.def.field_key] = serializeForLog(f.def, f.original, f.fileUrl);
              after[f.def.field_key] = serializeForLog(f.def, f.draft, f.fileUrl);
            }
            const diff = buildDiff(before, after);
            if (diff) {
              await logAdminAction({
                action: 'update',
                resourceType: 'users',
                resourceId: userId,
                details: { section: 'signup_fields', ...diff },
              });
            }

            // 저장 성공 후 재로딩 (파일 URL 반영 등)
            await loadFields();
            return true;
          } catch (err) {
            alert(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
            return false;
          }
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [fields, userId],
    );

    function updateDraft(idx: number, value: DraftValue) {
      setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, draft: value } : f)));
    }

    async function handleAddressSearch(idx: number) {
      try {
        await openDaumPostcode((data) => {
          const prev = fields[idx].draft as AddressValue | null;
          updateDraft(idx, {
            postal_code: data.zonecode,
            address1: data.address,
            address2: prev?.address2 ?? '',
          });
        });
      } catch (e) {
        alert(e instanceof Error ? e.message : '주소 검색을 열 수 없습니다.');
      }
    }

    if (loading) return null;
    if (fields.length === 0) return null;

    return (
      <>
        {fields.map((f, idx) => (
          <div key={f.def.id} className="flex items-start justify-between gap-4">
            <dt className="text-gray-500 shrink-0 pt-1">{f.def.label}</dt>
            <dd className="font-medium text-right flex-1">
              {editing
                ? renderEditor(f, (v) => updateDraft(idx, v), () => handleAddressSearch(idx))
                : formatForDisplay(f.def, f.original, f.fileUrl)}
            </dd>
          </div>
        ))}
      </>
    );
  },
);

function renderEditor(
  f: LoadedField,
  onChange: (v: DraftValue) => void,
  onAddressSearch: () => void,
): React.ReactNode {
  const d = f.def;
  const base =
    'w-full rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  // textarea
  if (d.field_type === 'textarea') {
    return (
      <textarea
        className={base}
        rows={3}
        value={(f.draft as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // select
  if (d.field_type === 'select') {
    return (
      <select
        className={base}
        value={(f.draft as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">선택</option>
        {(d.options ?? []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  // radio
  if (d.field_type === 'radio') {
    return (
      <div className="flex flex-wrap justify-end gap-3">
        {(d.options ?? []).map((o) => (
          <label key={o.value} className="inline-flex items-center gap-1 text-sm">
            <input
              type="radio"
              name={`radio-${d.id}`}
              checked={f.draft === o.value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    );
  }

  // checkbox
  if (d.field_type === 'checkbox') {
    if (d.options && d.options.length > 0) {
      const arr = Array.isArray(f.draft) ? (f.draft as string[]) : [];
      return (
        <div className="flex flex-wrap justify-end gap-3">
          {d.options.map((o) => {
            const checked = arr.includes(o.value);
            return (
              <label key={o.value} className="inline-flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...arr, o.value]
                      : arr.filter((v) => v !== o.value);
                    onChange(next);
                  }}
                />
                {o.label}
              </label>
            );
          })}
        </div>
      );
    }
    return (
      <label className="inline-flex items-center gap-1 text-sm">
        <input
          type="checkbox"
          checked={f.draft === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        {f.draft === true ? '체크' : '해제'}
      </label>
    );
  }

  // file
  if (d.field_type === 'file') {
    return (
      <div className="flex flex-col items-end gap-1">
        {f.fileUrl && !(f.draft instanceof File) && (
          <a href={f.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
            현재 파일
          </a>
        )}
        <input
          type="file"
          className="text-xs"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
        {f.draft instanceof File && (
          <span className="text-xs text-gray-500">선택됨: {f.draft.name}</span>
        )}
      </div>
    );
  }

  // address
  if (d.field_type === 'address') {
    const a = (f.draft as AddressValue | null) ?? { postal_code: '', address1: '', address2: '' };
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex w-full gap-2">
          <input
            type="text"
            readOnly
            placeholder="우편번호"
            className={`${base} flex-1`}
            value={a.postal_code}
          />
          <button
            type="button"
            onClick={onAddressSearch}
            className="rounded-md border border-blue-500 px-3 py-1 text-xs text-blue-600 hover:bg-blue-50"
          >
            주소 검색
          </button>
        </div>
        <input
          type="text"
          readOnly
          placeholder="주소"
          className={base}
          value={a.address1}
        />
        <input
          type="text"
          placeholder="상세 주소"
          className={base}
          value={a.address2}
          onChange={(e) => onChange({ ...a, address2: e.target.value })}
        />
      </div>
    );
  }

  // number
  if (d.field_type === 'number') {
    return (
      <input
        type="number"
        className={base}
        value={(f.draft as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // date/time/datetime
  if (d.field_type === 'date') {
    return (
      <input
        type="date"
        className={base}
        value={(f.draft as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (d.field_type === 'time') {
    return (
      <input
        type="time"
        className={base}
        value={(f.draft as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (d.field_type === 'datetime') {
    return (
      <input
        type="datetime-local"
        className={base}
        value={(f.draft as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // url
  if (d.field_type === 'url') {
    return (
      <input
        type="url"
        className={base}
        placeholder="https://"
        value={(f.draft as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // text / email / phone / default
  return (
    <input
      type="text"
      className={base}
      value={(f.draft as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
