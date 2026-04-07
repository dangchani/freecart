// joy: 회원 상세에 표시할 커스텀 회원가입 필드 값 섹션 (읽기 전용)
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

interface Row {
  id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  value_json: unknown;
  value_file_url: string | null;
  signup_field_definitions: {
    label: string;
    field_type: string;
    field_key: string;
    is_system: boolean;
  } | null;
}

export function UserCustomFieldsSection({ userId }: { userId: string }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('user_field_values')
        .select('id, value_text, value_number, value_date, value_json, value_file_url, signup_field_definitions(label, field_type, field_key, is_system)')
        .eq('user_id', userId);
      setRows((data as unknown as Row[]) ?? []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) return null;
  const customRows = rows.filter((r) => r.signup_field_definitions && !r.signup_field_definitions.is_system);
  if (customRows.length === 0) return null;

  return (
    <Card className="p-6">
      <h3 className="mb-3 text-lg font-bold">추가 입력 정보</h3>
      <dl className="space-y-2 text-sm">
        {customRows.map((r) => {
          const def = r.signup_field_definitions!;
          let display: React.ReactNode = '-';
          if (r.value_file_url) {
            display = (
              <a href={r.value_file_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                파일 다운로드
              </a>
            );
          } else if (r.value_text) display = r.value_text;
          else if (r.value_number != null) display = r.value_number;
          else if (r.value_date) display = r.value_date;
          else if (r.value_json) display = JSON.stringify(r.value_json);
          return (
            <div key={r.id} className="flex justify-between border-b pb-1 last:border-b-0">
              <dt className="text-gray-500">{def.label}</dt>
              <dd className="font-medium">{display}</dd>
            </div>
          );
        })}
      </dl>
    </Card>
  );
}
