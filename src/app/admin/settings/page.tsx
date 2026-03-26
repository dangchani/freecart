import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

interface Settings {
  siteName: string;
  siteDescription: string;
  shippingFee: string;
  freeShippingThreshold: string;
  pointEarnRate: string;
  signupPoints: string;
}

export default function AdminSettingsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<Settings>({
    siteName: '',
    siteDescription: '',
    shippingFee: '',
    freeShippingThreshold: '',
    pointEarnRate: '',
    signupPoints: '',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadSettings();
    }
  }, [user, authLoading, navigate]);

  async function loadSettings() {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('settings')
        .select('key, value');

      if (fetchError) throw fetchError;

      const map: Record<string, string> = {};
      (data || []).forEach((s) => {
        map[s.key] = s.value;
      });

      // Parse JSON values (settings store values as text, often JSON-encoded)
      const parseValue = (val: string | undefined) => {
        if (!val) return '';
        try {
          const parsed = JSON.parse(val);
          return String(parsed);
        } catch {
          return val;
        }
      };

      setSettings({
        siteName: parseValue(map['site_name']),
        siteDescription: parseValue(map['site_description']),
        shippingFee: parseValue(map['shipping_fee']),
        freeShippingThreshold: parseValue(map['free_shipping_threshold']),
        pointEarnRate: parseValue(map['point_earn_rate']),
        signupPoints: parseValue(map['signup_points']),
      });
    } catch {
      setError('설정을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const supabase = createClient();

      const settingsMap: Record<string, string> = {
        site_name: JSON.stringify(settings.siteName),
        site_description: JSON.stringify(settings.siteDescription),
        shipping_fee: JSON.stringify(settings.shippingFee ? parseInt(settings.shippingFee) : 0),
        free_shipping_threshold: JSON.stringify(settings.freeShippingThreshold ? parseInt(settings.freeShippingThreshold) : 0),
        point_earn_rate: JSON.stringify(settings.pointEarnRate ? parseFloat(settings.pointEarnRate) : 0),
        signup_points: JSON.stringify(settings.signupPoints ? parseInt(settings.signupPoints) : 0),
      };

      for (const [key, value] of Object.entries(settingsMap)) {
        const { error: upsertError } = await supabase
          .from('settings')
          .upsert(
            { key, value },
            { onConflict: 'key' }
          );

        if (upsertError) throw upsertError;
      }

      setSuccess('설정이 저장되었습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '설정 저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <h1 className="mb-6 text-3xl font-bold">사이트 설정</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-md bg-green-50 p-4 text-green-700">{success}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">사이트 기본 정보</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">사이트 이름</label>
              <input type="text" name="siteName" value={settings.siteName} onChange={handleChange} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="FreeCart" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">사이트 설명</label>
              <textarea name="siteDescription" value={settings.siteDescription} onChange={handleChange} rows={3} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="쇼핑몰 설명을 입력하세요" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">배송 설정</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">기본 배송비 (원)</label>
              <input type="number" name="shippingFee" value={settings.shippingFee} onChange={handleChange} min="0" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="3000" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">무료 배송 기준금액 (원)</label>
              <input type="number" name="freeShippingThreshold" value={settings.freeShippingThreshold} onChange={handleChange} min="0" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="50000" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">포인트 설정</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">기본 포인트 적립률 (%)</label>
              <input type="number" name="pointEarnRate" value={settings.pointEarnRate} onChange={handleChange} min="0" max="100" step="0.1" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="1" />
              <p className="mt-1 text-xs text-gray-500">구매금액의 몇 %를 포인트로 적립할지 설정합니다.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">회원가입 포인트 지급 (P)</label>
              <input type="number" name="signupPoints" value={settings.signupPoints} onChange={handleChange} min="0" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="1000" />
              <p className="mt-1 text-xs text-gray-500">신규 회원가입 시 지급할 포인트입니다.</p>
            </div>
          </div>
        </Card>

        <Button type="submit" disabled={submitting} className="w-full md:w-auto">
          {submitting ? '저장 중...' : '설정 저장'}
        </Button>
      </form>
    </div>
  );
}
