// joy: 회원가입 동적 폼. signup_field_definitions를 기반으로 렌더링하고, 제출 시
// auth.signUp → users 컬럼 업데이트 → user_field_values bulk insert → 파일 업로드 순서로 저장.
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { uploadSignupFile } from '@/lib/upload-signup-file';
import { DynamicField } from './DynamicField';
import type { FieldDefinition, FieldValue, FieldValueMap, AddressValue } from './types';

interface Props {
  onSuccess?: () => void;
  previewOnly?: boolean;              // 관리자 미리보기용
  previewDefinitions?: FieldDefinition[]; // 미리보기 시 주입
}

export function DynamicSignupForm({ onSuccess, previewOnly, previewDefinitions }: Props) {
  const supabase = createClient();
  const [definitions, setDefinitions] = useState<FieldDefinition[]>([]);
  const [values, setValues] = useState<FieldValueMap>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!previewOnly);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (previewDefinitions) {
      setDefinitions(previewDefinitions.filter((d) => d.is_active).sort((a, b) => a.sort_order - b.sort_order));
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('signup_field_definitions')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) setServerError(error.message);
      setDefinitions((data as FieldDefinition[]) ?? []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewDefinitions]);

  function setValue(key: string, v: FieldValue) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    for (const d of definitions) {
      const v = values[d.field_key];
      if (d.is_required) {
        const empty =
          v === null ||
          v === undefined ||
          v === '' ||
          v === false ||
          (Array.isArray(v) && v.length === 0) ||
          (typeof v === 'object' && v !== null && 'zonecode' in v && !(v as AddressValue).address);
        if (empty) {
          errs[d.field_key] = '필수 항목입니다';
          continue;
        }
      }
      if (d.field_type === 'email' && typeof v === 'string' && v) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errs[d.field_key] = '이메일 형식이 올바르지 않습니다';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (previewOnly) return;
    setServerError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      const email = String(values['email'] ?? '');
      const password = String(values['password'] ?? '');

      // users 컬럼 필드들을 metadata로 묶어서 handle_new_user 트리거가 쓰도록
      const usersMeta: Record<string, unknown> = {};
      const customFields: FieldDefinition[] = [];
      const fileFields: FieldDefinition[] = [];

      for (const d of definitions) {
        if (d.field_key === 'email' || d.field_key === 'password') continue;
        const v = values[d.field_key];
        if (d.storage_target === 'users') {
          if (d.field_key === 'privacy_agreement') {
            usersMeta['privacy_agreed_at'] = v === true ? new Date().toISOString() : null;
          } else if (d.field_type === 'address') {
            const a = v as AddressValue | null;
            if (a && a.address) usersMeta['_address'] = a;
          } else if (d.storage_column) {
            usersMeta[d.storage_column] = v;
          }
        } else if (d.storage_target === 'custom') {
          if (d.field_type === 'file') fileFields.push(d);
          else customFields.push(d);
        }
      }

      // 1) Supabase Auth 가입
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: usersMeta['name'], phone: usersMeta['phone'] } },
      });
      if (signUpErr) throw signUpErr;
      const newUserId = signUpData.user?.id;
      if (!newUserId) throw new Error('회원가입 응답에 user id가 없습니다.');

      // 2) users 컬럼 업데이트
      const usersUpdate: Record<string, unknown> = {};
      for (const k of ['name', 'phone', 'nickname']) {
        if (usersMeta[k] != null) usersUpdate[k] = usersMeta[k];
      }
      if (usersMeta['privacy_agreed_at']) usersUpdate['privacy_agreed_at'] = usersMeta['privacy_agreed_at'];
      if (Object.keys(usersUpdate).length > 0) {
        await supabase.from('users').update(usersUpdate).eq('id', newUserId);
      }

      // 3) 주소 → user_addresses
      if (usersMeta['_address']) {
        const a = usersMeta['_address'] as AddressValue;
        await supabase.from('user_addresses').insert({
          user_id: newUserId,
          zipcode: a.zonecode,
          address1: a.address,
          address2: a.detailAddress,
          is_default: true,
        });
      }

      // 4) 커스텀 필드 bulk insert
      if (customFields.length > 0) {
        const rows = customFields
          .map((d) => {
            const v = values[d.field_key];
            if (v === null || v === undefined || v === '') return null;
            const row: Record<string, unknown> = {
              user_id: newUserId,
              field_definition_id: d.id,
            };
            if (d.field_type === 'number' && typeof v === 'number') row.value_number = v;
            else if (['date', 'time', 'datetime'].includes(d.field_type) && typeof v === 'string') row.value_date = v;
            else if (Array.isArray(v) || (typeof v === 'object' && v !== null)) row.value_json = v;
            else row.value_text = String(v);
            return row;
          })
          .filter(Boolean);
        if (rows.length > 0) {
          const { error: cfErr } = await supabase.from('user_field_values').insert(rows as never);
          if (cfErr) console.error('custom fields insert failed:', cfErr.message);
        }
      }

      // 5) 파일 필드 업로드 후 insert
      for (const d of fileFields) {
        const f = values[d.field_key];
        if (!(f instanceof File)) continue;
        try {
          const url = await uploadSignupFile(newUserId, d.field_key, f);
          await supabase.from('user_field_values').insert({
            user_id: newUserId,
            field_definition_id: d.id,
            value_file_url: url,
          });
        } catch (e) {
          console.error('file upload failed:', e);
        }
      }

      onSuccess?.();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : '회원가입에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div>로딩 중...</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {definitions.map((d) => (
        <DynamicField
          key={d.id}
          definition={d}
          value={values[d.field_key] ?? null}
          onChange={(v) => setValue(d.field_key, v)}
          error={errors[d.field_key]}
          disabled={previewOnly || submitting}
        />
      ))}

      {serverError && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{serverError}</div>}

      {!previewOnly && (
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? '가입 중...' : '회원가입'}
        </Button>
      )}
    </form>
  );
}
