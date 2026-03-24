import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

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
      const response = await fetch('/api/admin/settings');
      const data = await response.json();
      if (data.success) {
        const s = data.data || {};
        setSettings({
          siteName: s.siteName || '',
          siteDescription: s.siteDescription || '',
          shippingFee: s.shippingFee != null ? String(s.shippingFee) : '',
          freeShippingThreshold:
            s.freeShippingThreshold != null ? String(s.freeShippingThreshold) : '',
          pointEarnRate: s.pointEarnRate != null ? String(s.pointEarnRate) : '',
          signupPoints: s.signupPoints != null ? String(s.signupPoints) : '',
        });
      } else {
        setError(data.error || '설정을 불러오지 못했습니다.');
      }
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
      const payload = {
        siteName: settings.siteName,
        siteDescription: settings.siteDescription,
        shippingFee: settings.shippingFee ? parseInt(settings.shippingFee) : 0,
        freeShippingThreshold: settings.freeShippingThreshold
          ? parseInt(settings.freeShippingThreshold)
          : 0,
        pointEarnRate: settings.pointEarnRate ? parseFloat(settings.pointEarnRate) : 0,
        signupPoints: settings.signupPoints ? parseInt(settings.signupPoints) : 0,
      };
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
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
        {/* 사이트 기본 정보 */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">사이트 기본 정보</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">사이트 이름</label>
              <input
                type="text"
                name="siteName"
                value={settings.siteName}
                onChange={handleChange}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="FreeCart"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">사이트 설명</label>
              <textarea
                name="siteDescription"
                value={settings.siteDescription}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="쇼핑몰 설명을 입력하세요"
              />
            </div>
          </div>
        </Card>

        {/* 배송 설정 */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">배송 설정</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                기본 배송비 (원)
              </label>
              <input
                type="number"
                name="shippingFee"
                value={settings.shippingFee}
                onChange={handleChange}
                min="0"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="3000"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                무료 배송 기준금액 (원)
              </label>
              <input
                type="number"
                name="freeShippingThreshold"
                value={settings.freeShippingThreshold}
                onChange={handleChange}
                min="0"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="50000"
              />
            </div>
          </div>
        </Card>

        {/* 포인트 설정 */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">포인트 설정</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                기본 포인트 적립률 (%)
              </label>
              <input
                type="number"
                name="pointEarnRate"
                value={settings.pointEarnRate}
                onChange={handleChange}
                min="0"
                max="100"
                step="0.1"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1"
              />
              <p className="mt-1 text-xs text-gray-500">구매금액의 몇 %를 포인트로 적립할지 설정합니다.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                회원가입 포인트 지급 (P)
              </label>
              <input
                type="number"
                name="signupPoints"
                value={settings.signupPoints}
                onChange={handleChange}
                min="0"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1000"
              />
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
