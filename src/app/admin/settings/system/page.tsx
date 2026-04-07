// joy: 시스템 전역 설정 페이지 - 담당자 기능 ON/OFF, 가입 승인 필요 여부
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { RequirePermission } from '@/components/permission-gate';

interface SettingRow {
  key: string;
  value: unknown;
  description: string | null;
}

const TOGGLE_KEYS = ['enable_user_assignment', 'require_signup_approval'] as const;
type ToggleKey = (typeof TOGGLE_KEYS)[number];

const LABELS: Record<ToggleKey, string> = {
  enable_user_assignment: '담당자 기능 사용',
  require_signup_approval: '회원가입 시 관리자 승인 필요',
};

function SystemSettingsInner() {
  const supabase = createClient();
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data, error: e } = await supabase
      .from('system_settings')
      .select('key, value, description')
      .in('key', TOGGLE_KEYS as unknown as string[]);
    if (e) setError(e.message);
    setRows(data ?? []);
    setLoading(false);
  }

  async function toggle(key: ToggleKey, current: boolean) {
    const warn =
      key === 'enable_user_assignment' && !current
        ? '담당자 기능을 켜면 담당자가 배정되지 않은 일반 관리자는 사용자/주문에 접근할 수 없게 됩니다. 계속하시겠습니까?'
        : key === 'require_signup_approval' && !current
          ? '승인 기능을 켜면 아직 승인되지 않은 일반 사용자는 로그인할 수 없게 됩니다. 계속하시겠습니까?'
          : null;
    if (warn && !confirm(warn)) return;

    setSaving(key);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const { error: e } = await supabase
      .from('system_settings')
      .update({ value: !current, updated_by: authUser?.id ?? null })
      .eq('key', key);
    if (e) setError(e.message);
    await load();
    setSaving(null);
  }

  if (loading) return <div className="p-8">로딩 중...</div>;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">시스템 설정</h1>
        <p className="mt-1 text-sm text-gray-500">전체 관리자 기능 동작 방식을 제어합니다.</p>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}

      <Card className="p-6 space-y-6">
        {TOGGLE_KEYS.map((key) => {
          const row = rows.find((r) => r.key === key);
          const value = row?.value === true;
          return (
            <div key={key} className="flex items-start justify-between gap-4 border-b pb-4 last:border-b-0 last:pb-0">
              <div>
                <div className="font-medium text-gray-900">{LABELS[key]}</div>
                <div className="mt-1 text-sm text-gray-500">{row?.description ?? ''}</div>
                <div className="mt-1 text-xs text-gray-400">
                  현재 상태: <span className={value ? 'text-green-600 font-medium' : 'text-gray-500'}>{value ? 'ON' : 'OFF'}</span>
                </div>
              </div>
              <Button
                variant={value ? 'destructive' : 'default'}
                disabled={saving === key}
                onClick={() => toggle(key, value)}
              >
                {saving === key ? '저장 중...' : value ? '끄기' : '켜기'}
              </Button>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

export default function SystemSettingsPage() {
  return (
    <RequirePermission superAdminOnly>
      <SystemSettingsInner />
    </RequirePermission>
  );
}
