import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { invalidateSettingsCache } from '@/services/settings';

interface Settings {
  // 사이트 기본 정보
  siteName: string;
  siteDescription: string;
  // 사업자 정보
  companyName: string;
  companyCeo: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyBusinessNumber: string;
  // 링크
  githubUrl: string;
  // 배송 설정
  shippingFee: string;
  freeShippingThreshold: string;
  // 포인트 설정
  pointEarnRate: string;
  signupPoints: string;
  pointsMinThreshold: string;
  pointsUnitAmount: string;
  pointsMaxUsagePercent: string;
  // 외부 연동
  storeApiUrl: string;
  naverClientId: string;
}

const defaultSettings: Settings = {
  siteName: '',
  siteDescription: '',
  companyName: '',
  companyCeo: '',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  companyBusinessNumber: '',
  githubUrl: '',
  shippingFee: '',
  freeShippingThreshold: '',
  pointEarnRate: '',
  signupPoints: '',
  pointsMinThreshold: '',
  pointsUnitAmount: '',
  pointsMaxUsagePercent: '',
  storeApiUrl: '',
  naverClientId: '',
};

// settings 테이블의 key와 JS 프로퍼티 매핑
const keyMap: Record<keyof Settings, string> = {
  siteName: 'site_name',
  siteDescription: 'site_description',
  companyName: 'company_name',
  companyCeo: 'company_ceo',
  companyAddress: 'company_address',
  companyPhone: 'company_phone',
  companyEmail: 'company_email',
  companyBusinessNumber: 'company_business_number',
  githubUrl: 'github_url',
  shippingFee: 'shipping_fee',
  freeShippingThreshold: 'free_shipping_threshold',
  pointEarnRate: 'point_earn_rate',
  signupPoints: 'signup_points',
  pointsMinThreshold: 'points_min_threshold',
  pointsUnitAmount: 'points_unit_amount',
  pointsMaxUsagePercent: 'points_max_usage_percent',
  storeApiUrl: 'store_api_url',
  naverClientId: 'naver_client_id',
};

export default function AdminSettingsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
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

      const dbMap: Record<string, string> = {};
      (data || []).forEach((s: any) => {
        dbMap[s.key] = s.value;
      });

      const parseValue = (val: string | undefined) => {
        if (!val) return '';
        try {
          return String(JSON.parse(val));
        } catch {
          return val;
        }
      };

      const loaded: any = {};
      for (const [prop, dbKey] of Object.entries(keyMap)) {
        loaded[prop] = parseValue(dbMap[dbKey]);
      }

      setSettings(loaded as Settings);
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

      for (const [prop, dbKey] of Object.entries(keyMap)) {
        const rawValue = (settings as any)[prop] || '';
        // 숫자형 필드는 숫자로 저장
        const numericKeys = ['shipping_fee', 'free_shipping_threshold', 'point_earn_rate', 'signup_points', 'points_min_threshold', 'points_unit_amount', 'points_max_usage_percent'];
        let value: string;
        if (numericKeys.includes(dbKey) && rawValue) {
          value = JSON.stringify(Number(rawValue) || 0);
        } else {
          value = JSON.stringify(rawValue);
        }

        const { error: upsertError } = await supabase
          .from('settings')
          .upsert({ key: dbKey, value }, { onConflict: 'key' });

        if (upsertError) throw upsertError;
      }

      invalidateSettingsCache();
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

      {error && <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-md bg-green-50 p-4 text-green-700">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 사이트 기본 정보 */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">사이트 기본 정보</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">사이트 이름</label>
              <input type="text" name="siteName" value={settings.siteName} onChange={handleChange} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Freecart" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">사이트 설명</label>
              <textarea name="siteDescription" value={settings.siteDescription} onChange={handleChange} rows={2} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="쇼핑몰 설명" />
            </div>
          </div>
        </Card>

        {/* 사업자 정보 */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">사업자 정보</h2>
          <p className="mb-4 text-xs text-gray-500">푸터에 표시되는 사업자 정보입니다.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">상호 (회사명)</label>
              <input type="text" name="companyName" value={settings.companyName} onChange={handleChange} placeholder="주식회사 ○○○" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">대표자명</label>
              <input type="text" name="companyCeo" value={settings.companyCeo} onChange={handleChange} placeholder="홍길동" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">사업장 주소</label>
              <input type="text" name="companyAddress" value={settings.companyAddress} onChange={handleChange} placeholder="서울특별시 강남구..." className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">대표전화</label>
              <input type="text" name="companyPhone" value={settings.companyPhone} onChange={handleChange} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="02-1234-5678" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">대표 이메일</label>
              <input type="email" name="companyEmail" value={settings.companyEmail} onChange={handleChange} placeholder="support@example.com" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">사업자등록번호</label>
              <input type="text" name="companyBusinessNumber" value={settings.companyBusinessNumber} onChange={handleChange} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="123-45-67890" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">GitHub URL</label>
              <input type="url" name="githubUrl" value={settings.githubUrl} onChange={handleChange} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://github.com/..." />
            </div>
          </div>
        </Card>

        {/* 배송 설정 */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">배송 설정</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">기본 배송비 (원)</label>
              <input type="number" name="shippingFee" value={settings.shippingFee} onChange={handleChange} min="0" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="3000" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">무료배송 기준금액 (원)</label>
              <input type="number" name="freeShippingThreshold" value={settings.freeShippingThreshold} onChange={handleChange} min="0" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="50000" />
            </div>
          </div>
        </Card>

        {/* 포인트 설정 */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">포인트 설정</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">기본 적립률 (%)</label>
              <input type="number" name="pointEarnRate" value={settings.pointEarnRate} onChange={handleChange} min="0" max="100" step="0.1" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="1" />
              <p className="mt-1 text-xs text-gray-500">구매금액 대비 포인트 적립 비율</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">회원가입 포인트 (P)</label>
              <input type="number" name="signupPoints" value={settings.signupPoints} onChange={handleChange} min="0" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="1000" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">최소 보유 포인트 (사용 기준)</label>
              <input type="number" name="pointsMinThreshold" value={settings.pointsMinThreshold} onChange={handleChange} min="0" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="1000" />
              <p className="mt-1 text-xs text-gray-500">이 금액 이상 보유 시 포인트 사용 가능</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">사용 단위 (원)</label>
              <input type="number" name="pointsUnitAmount" value={settings.pointsUnitAmount} onChange={handleChange} min="1" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="100" />
              <p className="mt-1 text-xs text-gray-500">포인트 사용 최소 단위</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">최대 사용 비율 (%)</label>
              <input type="number" name="pointsMaxUsagePercent" value={settings.pointsMaxUsagePercent} onChange={handleChange} min="1" max="100" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="50" />
              <p className="mt-1 text-xs text-gray-500">결제금액의 몇 %까지 포인트로 결제 가능</p>
            </div>
          </div>
        </Card>

        {/* 외부 연동 */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">외부 연동</h2>
          <p className="mb-4 text-xs text-gray-500">Supabase 접속 정보(URL, Key)는 .env 파일에서 관리합니다. 그 외 모든 설정은 여기서 관리합니다.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">스토어 API URL</label>
              <input type="url" name="storeApiUrl" value={settings.storeApiUrl} onChange={handleChange} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://freecart.kr" />
              <p className="mt-1 text-xs text-gray-500">테마/스킨 스토어 서버 주소</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">네이버 Client ID</label>
              <input type="text" name="naverClientId" value={settings.naverClientId} onChange={handleChange} placeholder="네이버 개발자센터에서 발급" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="mt-1 text-xs text-gray-500">네이버 소셜 로그인용 클라이언트 ID</p>
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
