// 마이페이지 프로필 - 추가 입력 정보 (회원이 직접 수정)
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { DynamicField } from '@/components/signup-fields/DynamicField';
import { uploadSignupFile } from '@/lib/upload-signup-file';
import type { FieldDefinition, FieldValue, FieldValueMap } from '@/components/signup-fields/types';

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

function fieldValueToRow(value: FieldValue, fieldType: string): Record<string, unknown> {
  const empty = { value_text: null, value_number: null, value_date: null, value_json: null, value_file_url: null };
  if (value === null || value === undefined || value === '') return empty;
  if (fieldType === 'number' && typeof value === 'number') return { ...empty, value_number: value };
  if (['date', 'time', 'datetime'].includes(fieldType) && typeof value === 'string') return { ...empty, value_date: value };
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return { ...empty, value_json: value };
  if (typeof value === 'boolean') return { ...empty, value_text: String(value) };
  return { ...empty, value_text: String(value) };
}

export function UserProfileCustomFields({ userId }: { userId: string }) {
  const supabase = createClient();
  const [definitions, setDefinitions] = useState<FieldDefinition[]>([]);
  const [valueRows, setValueRows] = useState<ValueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<FieldValueMap>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function load() {
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

    const initial: FieldValueMap = {};
    for (const def of defs) {
      const row = vals.find((r) => r.field_definition_id === def.id);
      initial[def.field_key] = row ? rowToFieldValue(row, def.field_type) : null;
    }
    setValues(initial);
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);

    // 필수 필드 검증
    for (const def of definitions) {
      if (def.is_required) {
        const v = values[def.field_key];
        const empty = v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
        if (empty) {
          setError(`"${def.label}"은(는) 필수 항목입니다.`);
          setSaving(false);
          return;
        }
      }
    }

    try {
      for (const def of definitions) {
        let value = values[def.field_key];
        const existingRow = valueRows.find((r) => r.field_definition_id === def.id);

        if (def.field_type === 'file' && value instanceof File) {
          value = await uploadSignupFile(userId, def.field_key, value);
        }

        const isEmpty =
          value === null || value === undefined || value === '' ||
          (Array.isArray(value) && value.length === 0);

        if (existingRow) {
          if (isEmpty) {
            await supabase.from('user_field_values').delete().eq('id', existingRow.id);
          } else if (def.field_type === 'file' && typeof value === 'string') {
            await supabase.from('user_field_values').update({ value_file_url: value, value_text: null }).eq('id', existingRow.id);
          } else {
            await supabase.from('user_field_values').update(fieldValueToRow(value, def.field_type)).eq('id', existingRow.id);
          }
        } else if (!isEmpty) {
          if (def.field_type === 'file' && typeof value === 'string') {
            await supabase.from('user_field_values').insert({ user_id: userId, field_definition_id: def.id, value_file_url: value });
          } else {
            await supabase.from('user_field_values').insert({ user_id: userId, field_definition_id: def.id, ...fieldValueToRow(value, def.field_type) });
          }
        }
      }
      await load();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || definitions.length === 0) return null;

  return (
    <Card className="mt-6 p-6">
      <h2 className="mb-4 text-lg font-bold">추가 정보</h2>
      <form onSubmit={handleSave} className="space-y-4">
        {definitions.map((def) => (
          <DynamicField
            key={def.id}
            definition={def}
            value={values[def.field_key] ?? null}
            onChange={(v) => setValues((prev) => ({ ...prev, [def.field_key]: v }))}
            disabled={saving}
          />
        ))}

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {saved && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">저장되었습니다.</div>
        )}

        <Button type="submit" disabled={saving}>
          {saving ? '저장 중...' : '추가 정보 저장'}
        </Button>
      </form>
    </Card>
  );
}
