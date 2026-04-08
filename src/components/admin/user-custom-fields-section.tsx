// 회원 상세 - 추가 입력 정보 섹션 (조회 + 관리자 편집)
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { DynamicField } from '@/components/signup-fields/DynamicField';
import { uploadSignupFile } from '@/lib/upload-signup-file';
import type { FieldDefinition, FieldValue, FieldValueMap } from '@/components/signup-fields/types';
import { Pencil, X, Save } from 'lucide-react';

interface ValueRow {
  id: string;
  field_definition_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_json: unknown;
  value_file_url: string | null;
}

function rowToFieldValue(row: ValueRow, fieldType: string): FieldValue {
  if (row.value_file_url) return row.value_file_url;
  if (row.value_number != null) return row.value_number;
  if (row.value_date) return row.value_date;
  if (row.value_json != null) {
    if (Array.isArray(row.value_json)) return row.value_json as string[];
    return row.value_json as FieldValue;
  }
  if (row.value_text != null) {
    if (fieldType === 'checkbox' && row.value_text === 'true') return true;
    if (fieldType === 'checkbox' && row.value_text === 'false') return false;
    return row.value_text;
  }
  return null;
}

function fieldValueToRow(value: FieldValue, fieldType: string): Partial<Omit<ValueRow, 'id' | 'field_definition_id'>> {
  if (value === null || value === undefined || value === '') {
    return { value_text: null, value_number: null, value_date: null, value_json: null, value_file_url: null };
  }
  if (fieldType === 'number' && typeof value === 'number') return { value_number: value };
  if (['date', 'time', 'datetime'].includes(fieldType) && typeof value === 'string') return { value_date: value };
  if (Array.isArray(value) || (typeof value === 'object' && value !== null && !('zonecode' in value))) {
    return { value_json: value };
  }
  if (typeof value === 'object' && 'zonecode' in value) return { value_json: value };
  if (typeof value === 'boolean') return { value_text: String(value) };
  return { value_text: String(value) };
}

export function UserCustomFieldsSection({ userId }: { userId: string }) {
  const supabase = createClient();
  const [definitions, setDefinitions] = useState<FieldDefinition[]>([]);
  const [valueRows, setValueRows] = useState<ValueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FieldValueMap>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function load() {
    setLoading(true);
    const [defsRes, valsRes] = await Promise.all([
      supabase
        .from('signup_field_definitions')
        .select('*')
        .eq('is_active', true)
        .eq('is_system', false)
        .eq('storage_target', 'custom')
        .order('sort_order'),
      supabase
        .from('user_field_values')
        .select('id, field_definition_id, value_text, value_number, value_date, value_json, value_file_url')
        .eq('user_id', userId),
    ]);
    const defs = (defsRes.data as FieldDefinition[]) ?? [];
    const vals = (valsRes.data as ValueRow[]) ?? [];
    setDefinitions(defs);
    setValueRows(vals);
    setLoading(false);
  }

  function startEdit() {
    const initial: FieldValueMap = {};
    for (const def of definitions) {
      const row = valueRows.find((r) => r.field_definition_id === def.id);
      initial[def.field_key] = row ? rowToFieldValue(row, def.field_type) : null;
    }
    setDraft(initial);
    setSaveError('');
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft({});
    setSaveError('');
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    try {
      for (const def of definitions) {
        const value = draft[def.field_key];
        const existingRow = valueRows.find((r) => r.field_definition_id === def.id);

        // 파일 타입: File 객체면 업로드
        let resolvedValue = value;
        if (def.field_type === 'file' && value instanceof File) {
          const url = await uploadSignupFile(userId, def.field_key, value);
          resolvedValue = url;
        }

        // 빈 값 처리
        const isEmpty =
          resolvedValue === null ||
          resolvedValue === undefined ||
          resolvedValue === '' ||
          (Array.isArray(resolvedValue) && resolvedValue.length === 0);

        if (existingRow) {
          if (isEmpty) {
            // 기존 값 삭제
            await supabase.from('user_field_values').delete().eq('id', existingRow.id);
          } else {
            const rowData = fieldValueToRow(resolvedValue, def.field_type);
            if (def.field_type === 'file' && typeof resolvedValue === 'string') {
              await supabase.from('user_field_values').update({ value_file_url: resolvedValue, value_text: null }).eq('id', existingRow.id);
            } else {
              await supabase.from('user_field_values').update({
                value_text: null, value_number: null, value_date: null, value_json: null, value_file_url: null,
                ...rowData,
              }).eq('id', existingRow.id);
            }
          }
        } else if (!isEmpty) {
          const rowData = fieldValueToRow(resolvedValue, def.field_type);
          if (def.field_type === 'file' && typeof resolvedValue === 'string') {
            await supabase.from('user_field_values').insert({ user_id: userId, field_definition_id: def.id, value_file_url: resolvedValue });
          } else {
            await supabase.from('user_field_values').insert({ user_id: userId, field_definition_id: def.id, ...rowData });
          }
        }
      }
      await load();
      setEditing(false);
      setDraft({});
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;
  if (definitions.length === 0) return null;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">추가 입력 정보</h3>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={startEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> 수정
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>
              <X className="h-3.5 w-3.5 mr-1" /> 취소
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-3.5 w-3.5 mr-1" /> {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        )}
      </div>

      {saveError && (
        <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{saveError}</div>
      )}

      {!editing ? (
        // 읽기 모드
        <dl className="space-y-2 text-sm">
          {definitions.map((def) => {
            const row = valueRows.find((r) => r.field_definition_id === def.id);
            let display: React.ReactNode = <span className="text-gray-400">미입력</span>;
            if (row) {
              if (row.value_file_url) {
                display = (
                  <a href={row.value_file_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                    파일 보기
                  </a>
                );
              } else if (row.value_text != null) display = row.value_text;
              else if (row.value_number != null) display = String(row.value_number);
              else if (row.value_date) display = row.value_date.slice(0, 10);
              else if (row.value_json != null) {
                display = Array.isArray(row.value_json)
                  ? (row.value_json as string[]).join(', ')
                  : JSON.stringify(row.value_json);
              }
            }
            return (
              <div key={def.id} className="flex justify-between border-b pb-2 last:border-b-0">
                <dt className="text-gray-500 shrink-0 mr-4">
                  {def.label}
                  {def.is_required && <span className="text-red-500 ml-0.5">*</span>}
                </dt>
                <dd className="font-medium text-right">{display}</dd>
              </div>
            );
          })}
        </dl>
      ) : (
        // 편집 모드
        <div className="space-y-4">
          {definitions.map((def) => (
            <DynamicField
              key={def.id}
              definition={def}
              value={draft[def.field_key] ?? null}
              onChange={(v) => setDraft((prev) => ({ ...prev, [def.field_key]: v }))}
              disabled={saving}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
