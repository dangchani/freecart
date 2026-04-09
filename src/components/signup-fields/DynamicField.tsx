// joy: field_type별 입력 컴포넌트 + 라우터. 빌더 미리보기와 실제 회원가입 폼에서 공용.
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { openDaumPostcode } from '@/lib/daum-postcode';
import { TermsField } from './TermsField';
import { createClient } from '@/lib/supabase/client';
import type { FieldDefinition, FieldValue, AddressValue } from './types';

function formatPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.startsWith('02')) {
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  }
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

interface Props {
  definition: FieldDefinition;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  error?: string;
  disabled?: boolean;
}

function Wrapper({
  definition,
  error,
  children,
}: {
  definition: FieldDefinition;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label>
        {definition.label}
        {definition.is_required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {children}
      {definition.help_text && <p className="text-xs text-gray-500">{definition.help_text}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function DynamicField({ definition, value, onChange, error, disabled }: Props) {
  const { field_type, field_key, placeholder } = definition;

  // 전화번호 — 하이픈 자동 포맷
  if (field_type === 'phone') {
    return (
      <Wrapper definition={definition} error={error}>
        <Input
          type="tel"
          placeholder={placeholder ?? '010-0000-0000'}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(formatPhone(e.target.value))}
          disabled={disabled}
        />
      </Wrapper>
    );
  }

  // 아이디 — 중복 확인 버튼
  if (field_key === 'login_id') {
    return <LoginIdField definition={definition} value={value} onChange={onChange} error={error} disabled={disabled} />;
  }

  // 비밀번호 — 확인 입력
  if (field_type === 'password' || field_key === 'password') {
    return <PasswordField definition={definition} value={value} onChange={onChange} error={error} disabled={disabled} />;
  }

  // text / email / url
  if (['text', 'email', 'url'].includes(field_type)) {
    const inputType = field_type === 'email' ? 'email' : field_type === 'url' ? 'url' : 'text';
    return (
      <Wrapper definition={definition} error={error}>
        <Input
          type={inputType}
          placeholder={placeholder ?? ''}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      </Wrapper>
    );
  }

  if (field_type === 'textarea') {
    return (
      <Wrapper definition={definition} error={error}>
        <textarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder={placeholder ?? ''}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      </Wrapper>
    );
  }

  if (field_type === 'number') {
    return (
      <Wrapper definition={definition} error={error}>
        <Input
          type="number"
          placeholder={placeholder ?? ''}
          value={typeof value === 'number' || typeof value === 'string' ? String(value) : ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          disabled={disabled}
        />
      </Wrapper>
    );
  }

  if (field_type === 'date' || field_type === 'time' || field_type === 'datetime') {
    const inputType = field_type === 'datetime' ? 'datetime-local' : field_type;
    return (
      <Wrapper definition={definition} error={error}>
        <Input
          type={inputType}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      </Wrapper>
    );
  }

  if (field_type === 'select') {
    return (
      <Wrapper definition={definition} error={error}>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">선택하세요</option>
          {(definition.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Wrapper>
    );
  }

  if (field_type === 'radio') {
    return (
      <Wrapper definition={definition} error={error}>
        <div className="space-y-1">
          {(definition.options ?? []).map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={field_key}
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
                disabled={disabled}
              />
              {o.label}
            </label>
          ))}
        </div>
      </Wrapper>
    );
  }

  if (field_type === 'checkbox') {
    // 옵션이 있으면 복수선택, 없으면 단일 동의 체크박스
    const options = definition.options ?? [];
    if (options.length === 0) {
      const checked = value === true;
      return (
        <Wrapper definition={definition} error={error}>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled}
            />
            동의합니다
          </label>
        </Wrapper>
      );
    }
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <Wrapper definition={definition} error={error}>
        <div className="space-y-1">
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={arr.includes(o.value)}
                onChange={(e) => {
                  const next = e.target.checked ? [...arr, o.value] : arr.filter((v) => v !== o.value);
                  onChange(next);
                }}
                disabled={disabled}
              />
              {o.label}
            </label>
          ))}
        </div>
      </Wrapper>
    );
  }

  if (field_type === 'address') {
    const addr: AddressValue =
      value && typeof value === 'object' && 'zonecode' in value
        ? (value as AddressValue)
        : { zonecode: '', address: '', detailAddress: '' };
    const openPopup = async () => {
      try {
        await openDaumPostcode((data) => {
          onChange({
            zonecode: data.zonecode,
            address: data.roadAddress || data.address,
            detailAddress: addr.detailAddress,
          });
        });
      } catch (e) {
        alert('우편번호 서비스를 불러오지 못했습니다.');
        console.error(e);
      }
    };
    return (
      <Wrapper definition={definition} error={error}>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input placeholder="우편번호" value={addr.zonecode} readOnly disabled={disabled} />
            <Button type="button" variant="outline" onClick={openPopup} disabled={disabled}>
              주소 검색
            </Button>
          </div>
          <Input placeholder="기본 주소" value={addr.address} readOnly disabled={disabled} />
          <Input
            placeholder="상세 주소"
            value={addr.detailAddress}
            onChange={(e) => onChange({ ...addr, detailAddress: e.target.value })}
            disabled={disabled}
          />
        </div>
      </Wrapper>
    );
  }

  if (field_type === 'file') {
    return <FileFieldInner definition={definition} value={value} onChange={onChange} error={error} disabled={disabled} />;
  }

  if (field_type === 'terms') {
    const t = definition.terms;
    if (!t) return null;
    return (
      <TermsField
        fieldKey={field_key}
        label={definition.label}
        isRequired={definition.is_required}
        helpText={definition.help_text}
        termsTitle={t.title}
        termsContent={t.content}
        value={value === true}
        onChange={(checked) => onChange(checked)}
        error={error}
      />
    );
  }

  return null;
}

function FileFieldInner({ definition, value, onChange, error, disabled }: Props) {
  const [fileName, setFileName] = useState<string>(value instanceof File ? value.name : '');
  return (
    <Wrapper definition={definition} error={error}>
      <Input
        type="file"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setFileName(f?.name ?? '');
          onChange(f);
        }}
        disabled={disabled}
      />
      {fileName && <p className="text-xs text-gray-500">선택됨: {fileName}</p>}
    </Wrapper>
  );
}

function LoginIdField({ definition, value, onChange, error, disabled }: Props) {
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<'ok' | 'dup' | null>(null);

  async function checkDuplicate() {
    const v = typeof value === 'string' ? value.trim() : '';
    if (!v) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const supabase = createClient();
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('login_id', v);
      setCheckResult(count === 0 ? 'ok' : 'dup');
    } finally {
      setChecking(false);
    }
  }

  function handleChange(v: string) {
    setCheckResult(null);
    onChange(v);
  }

  return (
    <Wrapper definition={definition} error={error}>
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder={definition.placeholder ?? '영문, 숫자 5자 이상'}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          className="flex-1"
        />
        <Button type="button" variant="outline" onClick={checkDuplicate}
          disabled={disabled || checking || !value}>
          {checking ? '확인 중...' : '중복확인'}
        </Button>
      </div>
      {checkResult === 'ok' && <p className="text-xs text-green-600">사용 가능한 아이디입니다.</p>}
      {checkResult === 'dup' && <p className="text-xs text-red-600">이미 사용 중인 아이디입니다.</p>}
    </Wrapper>
  );
}

function PasswordField({ definition, value, onChange, error, disabled }: Props) {
  const [raw, setRaw] = useState('');
  const [confirm, setConfirm] = useState('');

  function sync(p: string, c: string) {
    onChange(p && c && p === c ? p : '');
  }

  return (
    <Wrapper definition={definition} error={raw.length === 0 ? error : undefined}>
      <Input
        type="password"
        placeholder={definition.placeholder ?? '비밀번호'}
        value={raw}
        onChange={(e) => { setRaw(e.target.value); sync(e.target.value, confirm); }}
        disabled={disabled}
      />
      <div className="mt-2">
        <Input
          type="password"
          placeholder="비밀번호 확인"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); sync(raw, e.target.value); }}
          disabled={disabled}
        />
        {confirm.length > 0 && (
          raw === confirm
            ? <p className="mt-1 text-xs text-green-600">비밀번호가 일치합니다.</p>
            : <p className="mt-1 text-xs text-red-500">비밀번호가 일치하지 않습니다.</p>
        )}
      </div>
    </Wrapper>
  );
}
