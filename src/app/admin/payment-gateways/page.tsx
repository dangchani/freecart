import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Eye, EyeOff, CheckCircle, Circle } from 'lucide-react';

interface PaymentGateway {
  id: string;
  provider: string;
  name: string;
  clientKey: string;
  secretKey: string;
  isActive: boolean;
  settings: Record<string, string> | null;
}

const PG_PROVIDERS = [
  {
    provider: 'toss',
    name: '토스페이먼츠',
    description: '토스페이먼츠 결제 연동',
    fields: [
      { key: 'client_key', label: '클라이언트 키 (공개)', placeholder: 'test_ck_...' },
      { key: 'secret_key', label: '시크릿 키 (비공개)', placeholder: 'test_sk_...' },
    ],
  },
  {
    provider: 'inicis',
    name: 'KG이니시스',
    description: 'KG이니시스 결제 연동',
    fields: [
      { key: 'client_key', label: '상점 ID (MID)', placeholder: 'INIpayTest' },
      { key: 'secret_key', label: 'API 키', placeholder: '' },
      { key: 'sign_key', label: '사인 키', placeholder: '' },
    ],
  },
  {
    provider: 'kiwoom',
    name: '키움페이',
    description: '키움페이 결제 연동',
    fields: [
      { key: 'client_key', label: '상점 ID (MID)', placeholder: '' },
      { key: 'secret_key', label: 'API 시크릿 키', placeholder: '' },
    ],
  },
  {
    provider: 'kcp',
    name: 'NHN KCP',
    description: 'NHN KCP 결제 연동',
    fields: [
      { key: 'client_key', label: '사이트 코드', placeholder: 'T0000' },
      { key: 'secret_key', label: '사이트 키', placeholder: '' },
    ],
  },
  {
    provider: 'nicepay',
    name: '나이스페이먼츠',
    description: '나이스페이먼츠 결제 연동',
    fields: [
      { key: 'client_key', label: '클라이언트 ID', placeholder: '' },
      { key: 'secret_key', label: '시크릿 키', placeholder: '' },
    ],
  },
];

export default function AdminPaymentGatewaysPage() {
  const [gateways, setGateways] = useState<Record<string, PaymentGateway>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadGateways();
  }, []);

  async function loadGateways() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('payment_gateways')
        .select('id, provider, name, client_key, secret_key, is_active, settings');

      if (error) throw error;

      const mapped: Record<string, PaymentGateway> = {};
      const forms: Record<string, Record<string, string>> = {};

      (data || []).forEach((g: any) => {
        mapped[g.provider] = {
          id: g.id,
          provider: g.provider,
          name: g.name,
          clientKey: g.client_key || '',
          secretKey: g.secret_key || '',
          isActive: g.is_active,
          settings: g.settings,
        };
        forms[g.provider] = {
          client_key: g.client_key || '',
          secret_key: g.secret_key || '',
          ...(g.settings || {}),
        };
      });

      // 미등록 PG는 빈 폼으로 초기화
      PG_PROVIDERS.forEach(({ provider }) => {
        if (!forms[provider]) {
          forms[provider] = {};
        }
      });

      setGateways(mapped);
      setFormData(forms);
    } catch (err) {
      console.error('Failed to load payment gateways:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(provider: string) {
    setSaving(provider);
    setMessage(null);
    try {
      const supabase = createClient();
      const pgConfig = PG_PROVIDERS.find((p) => p.provider === provider)!;
      const form = formData[provider] || {};

      const { client_key, secret_key, ...extraSettings } = form;

      const payload = {
        provider,
        name: pgConfig.name,
        client_key: client_key || null,
        secret_key: secret_key || null,
        settings: Object.keys(extraSettings).length > 0 ? extraSettings : null,
        is_active: gateways[provider]?.isActive ?? false,
      };

      if (gateways[provider]?.id) {
        const { error } = await supabase
          .from('payment_gateways')
          .update(payload)
          .eq('id', gateways[provider].id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('payment_gateways')
          .insert(payload);
        if (error) throw error;
      }

      setMessage({ type: 'success', text: `${pgConfig.name} 설정이 저장되었습니다.` });
      await loadGateways();
    } catch (err) {
      console.error('Failed to save gateway:', err);
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
    } finally {
      setSaving(null);
    }
  }

  async function handleToggleActive(provider: string) {
    const current = gateways[provider];
    if (!current?.id) {
      setMessage({ type: 'error', text: '먼저 설정을 저장해주세요.' });
      return;
    }

    const newActive = !current.isActive;

    try {
      const supabase = createClient();

      // 활성화 시 다른 PG 비활성화
      if (newActive) {
        await supabase
          .from('payment_gateways')
          .update({ is_active: false })
          .neq('provider', provider);
      }

      await supabase
        .from('payment_gateways')
        .update({ is_active: newActive })
        .eq('id', current.id);

      setMessage({
        type: 'success',
        text: newActive ? `${current.name}이 활성화되었습니다.` : `${current.name}이 비활성화되었습니다.`,
      });
      await loadGateways();
    } catch (err) {
      console.error('Failed to toggle active:', err);
      setMessage({ type: 'error', text: '상태 변경 중 오류가 발생했습니다.' });
    }
  }

  function updateField(provider: string, key: string, value: string) {
    setFormData((prev) => ({
      ...prev,
      [provider]: { ...(prev[provider] || {}), [key]: value },
    }));
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-gray-200 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const activePg = Object.values(gateways).find((g) => g.isActive);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">PG사 설정</h1>
        <p className="text-sm text-gray-500 mt-1">결제 대행사(PG) 연동 정보를 관리합니다. 하나의 PG만 활성화할 수 있습니다.</p>
      </div>

      {activePg && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" />
          현재 활성 PG: <strong>{activePg.name}</strong>
        </div>
      )}

      {message && (
        <div
          className={`mb-6 rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {PG_PROVIDERS.map((pgConfig) => {
          const gateway = gateways[pgConfig.provider];
          const isRegistered = !!gateway?.id;
          const isActive = gateway?.isActive ?? false;
          const form = formData[pgConfig.provider] || {};

          return (
            <Card key={pgConfig.provider} className={`p-6 ${isActive ? 'border-green-400 ring-1 ring-green-400' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 flex items-center gap-2">
                      {pgConfig.name}
                      {isActive && (
                        <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          활성
                        </span>
                      )}
                    </h2>
                    <p className="text-sm text-gray-500">{pgConfig.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleActive(pgConfig.provider)}
                  className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {isActive ? (
                    <><CheckCircle className="h-4 w-4" /> 활성화됨</>
                  ) : (
                    <><Circle className="h-4 w-4" /> 비활성</>
                  )}
                </button>
              </div>

              <div className="space-y-3">
                {pgConfig.fields.map((field) => (
                  <div key={field.key}>
                    <Label className="text-sm font-medium">{field.label}</Label>
                    <div className="relative mt-1">
                      <Input
                        type={field.key === 'secret_key' && !showSecret[pgConfig.provider] ? 'password' : 'text'}
                        value={form[field.key] || ''}
                        onChange={(e) => updateField(pgConfig.provider, field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="pr-10"
                      />
                      {field.key === 'secret_key' && (
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          onClick={() =>
                            setShowSecret((prev) => ({
                              ...prev,
                              [pgConfig.provider]: !prev[pgConfig.provider],
                            }))
                          }
                        >
                          {showSecret[pgConfig.provider] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {isRegistered ? '등록된 PG사입니다.' : '아직 등록되지 않은 PG사입니다.'}
                </p>
                <Button
                  onClick={() => handleSave(pgConfig.provider)}
                  disabled={saving === pgConfig.provider}
                  size="sm"
                >
                  {saving === pgConfig.provider ? '저장 중...' : '저장'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-8 p-6 bg-amber-50 border-amber-200">
        <h3 className="font-bold text-amber-900 mb-2">⚠️ 보안 주의사항</h3>
        <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
          <li>시크릿 키는 절대 외부에 노출되어선 안 됩니다.</li>
          <li>시크릿 키는 Supabase Edge Function에서만 사용되며, 클라이언트에 전달되지 않습니다.</li>
          <li>실서비스 전환 시 반드시 테스트 키를 운영 키로 교체해주세요.</li>
          <li>PG사 관리자 페이지에서 허용 도메인/IP를 설정하세요.</li>
        </ul>
      </Card>
    </div>
  );
}
