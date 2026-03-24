import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';

interface NotificationSettings {
  emailOrder: boolean;
  emailShipping: boolean;
  emailMarketing: boolean;
  smsOrder: boolean;
  smsShipping: boolean;
  smsMarketing: boolean;
  pushEnabled: boolean;
}

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>({
    emailOrder: false,
    emailShipping: false,
    emailMarketing: false,
    smsOrder: false,
    smsShipping: false,
    smsMarketing: false,
    pushEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      fetchSettings();
    }
  }, [user, authLoading, navigate]);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/users/me/notification-settings');
      const json = await res.json();
      if (json.success) setSettings(json.data);
    } catch (err) {
      console.error('알림 설정 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/users/me/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ type: 'success', text: '알림 설정이 저장되었습니다.' });
      } else {
        setMessage({ type: 'error', text: json.error || '저장에 실패했습니다.' });
      }
    } catch (err) {
      console.error('알림 설정 저장 실패:', err);
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
    } finally {
      setSaving(false);
    }
  }

  function set(key: keyof NotificationSettings) {
    return (value: boolean) => setSettings((prev) => ({ ...prev, [key]: value }));
  }

  if (authLoading || loading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">알림 설정</h1>

      <div className="space-y-4">
        {/* 이메일 알림 */}
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <Bell className="h-5 w-5 text-blue-500" />
            이메일 알림
          </h2>
          <div className="space-y-4">
            {[
              { key: 'emailOrder' as const, label: '주문 알림', desc: '주문 접수, 결제 완료 등의 알림' },
              { key: 'emailShipping' as const, label: '배송 알림', desc: '배송 시작, 배송 완료 등의 알림' },
              { key: 'emailMarketing' as const, label: '마케팅 알림', desc: '할인 쿠폰, 이벤트, 프로모션 알림' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-sm text-gray-500">{desc}</p>
                </div>
                <Toggle checked={settings[key]} onChange={set(key)} />
              </div>
            ))}
          </div>
        </Card>

        {/* SMS 알림 */}
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <Bell className="h-5 w-5 text-green-500" />
            SMS 알림
          </h2>
          <div className="space-y-4">
            {[
              { key: 'smsOrder' as const, label: '주문 알림', desc: '주문 접수, 결제 완료 등의 SMS' },
              { key: 'smsShipping' as const, label: '배송 알림', desc: '배송 시작, 배송 완료 등의 SMS' },
              { key: 'smsMarketing' as const, label: '마케팅 알림', desc: '할인 쿠폰, 이벤트, 프로모션 SMS' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-sm text-gray-500">{desc}</p>
                </div>
                <Toggle checked={settings[key]} onChange={set(key)} />
              </div>
            ))}
          </div>
        </Card>

        {/* 푸시 알림 */}
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <Bell className="h-5 w-5 text-purple-500" />
            푸시 알림
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">푸시 알림 수신</p>
              <p className="text-sm text-gray-500">앱/브라우저 푸시 알림을 받습니다.</p>
            </div>
            <Toggle checked={settings.pushEnabled} onChange={set('pushEnabled')} />
          </div>
        </Card>
      </div>

      {message && (
        <div className={`mt-4 rounded-md px-4 py-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {message.text}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? '저장 중...' : '설정 저장'}
        </Button>
      </div>
    </div>
  );
}
