// joy: 회원 상세에 표시할 동적 회원가입 필드 섹션
// signup_field_definitions의 활성 필드(기본 4개 제외)를 storage_target에 따라 값 조회 후 렌더
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// 기본 정보 카드에서 이미 표시되는 필드 (이메일/이름/휴대폰/가입일)
// password는 절대 노출 금지
const EXCLUDED_KEYS = new Set(['email', 'password', 'name', 'phone']);

interface FieldDef {
  id: string;
  field_key: string;
  label: string;
  field_type: string;
  sort_order: number;
  storage_target: 'auth' | 'users' | 'custom';
  storage_column: string | null;
  is_active: boolean;
}

interface DisplayItem {
  key: string;
  label: string;
  value: React.ReactNode;
}

export function UserSignupFieldsSection({ userId }: { userId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // 1) 활성 필드 정의 조회
      const { data: defsData } = await supabase
        .from('signup_field_definitions')
        .select('id, field_key, label, field_type, sort_order, storage_target, storage_column, is_active')
        .eq('is_active', true)
        .order('sort_order');
      const defs = ((defsData as FieldDef[]) ?? []).filter((d) => !EXCLUDED_KEYS.has(d.field_key));

      if (defs.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      // 2) users 테이블 컬럼 필드들을 한 번에 조회
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
        userRow = (data as Record<string, unknown>) ?? {};
      }

      // 3) 주소 필드가 있으면 기본 배송지 조회
      const hasAddress = defs.some((d) => d.field_type === 'address');
      let addressText = '';
      if (hasAddress) {
        const { data: addr } = await supabase
          .from('user_addresses')
          .select('postal_code, address1, address2')
          .eq('user_id', userId)
          .eq('is_default', true)
          .maybeSingle();
        if (addr) {
          addressText = [
            addr.postal_code ? `(${addr.postal_code})` : '',
            addr.address1,
            addr.address2,
          ]
            .filter(Boolean)
            .join(' ');
        }
      }

      // 4) custom 필드 값 조회
      const customDefIds = defs.filter((d) => d.storage_target === 'custom').map((d) => d.id);
      let customMap = new Map<string, any>();
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

      // 5) 정의 순서대로 표시 아이템 생성
      const result: DisplayItem[] = defs.map((d) => {
        let value: React.ReactNode = '-';

        if (d.field_type === 'address') {
          value = addressText || '-';
        } else if (d.storage_target === 'users' && d.storage_column) {
          const raw = userRow[d.storage_column];
          if (d.field_key === 'privacy_agreement') {
            value = raw ? '동의함' : '미동의';
          } else if (raw != null && raw !== '') {
            value = String(raw);
          }
        } else if (d.storage_target === 'custom') {
          const row = customMap.get(d.id);
          if (row) {
            if (row.value_file_url) {
              value = (
                <a
                  href={row.value_file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline"
                >
                  파일 다운로드
                </a>
              );
            } else if (row.value_text) value = row.value_text;
            else if (row.value_number != null) value = row.value_number;
            else if (row.value_date) value = row.value_date;
            else if (row.value_json) value = JSON.stringify(row.value_json);
          }
        }

        return { key: d.id, label: d.label, value };
      });

      setItems(result);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <>
      {items.map((it) => (
        <div key={it.key} className="flex justify-between">
          <dt className="text-gray-500">{it.label}</dt>
          <dd className="font-medium text-right">{it.value}</dd>
        </div>
      ))}
    </>
  );
}
