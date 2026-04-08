import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { invalidateSettingsCache } from '@/services/settings';
import { getOAuthConnection, startOAuthFlow, disconnectOAuth, OAuthConnection } from '@/services/oauth';

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
  // 무통장입금
  bankTransferEnabled: string;
  bankTransferBankName: string;
  bankTransferAccountNumber: string;
  bankTransferAccountHolder: string;
  bankTransferDeadlineHours: string;
  // 이메일 / SMTP 설정
  supabaseAccessToken: string;
  emailConfirmRequired: string; // 'true' | 'false'
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpSenderName: string;
  smtpSenderEmail: string;
  // 폐쇄몰 설정
  closedMallEnabled: string; // 'true' | 'false'
  closedMallMode: string;    // 'full' | 'product'
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
  bankTransferEnabled: 'false',
  bankTransferBankName: '',
  bankTransferAccountNumber: '',
  bankTransferAccountHolder: '',
  bankTransferDeadlineHours: '24',
  supabaseAccessToken: '',
  emailConfirmRequired: 'false',
  smtpHost: '',
  smtpPort: '587',
  smtpUser: '',

  smtpPass: '',
  smtpSenderName: '',
  smtpSenderEmail: '',
  closedMallEnabled: 'false',
  closedMallMode: 'product',
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
  bankTransferEnabled: 'bank_transfer_enabled',
  bankTransferBankName: 'bank_transfer_bank_name',
  bankTransferAccountNumber: 'bank_transfer_account_number',
  bankTransferAccountHolder: 'bank_transfer_account_holder',
  bankTransferDeadlineHours: 'bank_transfer_deadline_hours',
  supabaseAccessToken: 'supabase_access_token',
  emailConfirmRequired: 'email_confirm_required',
  smtpHost: 'smtp_host',
  smtpPort: 'smtp_port',
  smtpUser: 'smtp_user',
  smtpPass: 'smtp_pass',
  smtpSenderName: 'smtp_sender_name',
  smtpSenderEmail: 'smtp_sender_email',
  closedMallEnabled: 'closed_mall_enabled',
  closedMallMode: 'closed_mall_mode',
};

export default function AdminSettingsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [applyError, setApplyError] = useState('');
  const [applySuccess, setApplySuccess] = useState('');

  // freecart-web OAuth 연동 상태
  const [oauthConn, setOauthConn] = useState<OAuthConnection | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthMsg, setOauthMsg] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadSettings();
      getOAuthConnection().then(setOauthConn).catch(() => {});
    }
  }, [user, authLoading, navigate]);

  async function handleOAuthConnect() {
    setOauthLoading(true);
    setOauthMsg('');
    try {
      const result = await startOAuthFlow();
      if (result.success) {
        setOauthMsg(`연동 완료: ${result.email}`);
        const conn = await getOAuthConnection();
        setOauthConn(conn);
      } else {
        setOauthMsg(result.error || '연동 실패');
      }
    } finally {
      setOauthLoading(false);
    }
  }

  async function handleOAuthDisconnect() {
    if (!confirm('freecart-web 연동을 해제하시겠습니까?')) return;
    setOauthLoading(true);
    setOauthMsg('');
    try {
      await disconnectOAuth();
      setOauthConn(null);
      setOauthMsg('연동이 해제되었습니다.');
    } finally {
      setOauthLoading(false);
    }
  }

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

  async function handleApplyToSupabase() {
    if (!settings.supabaseAccessToken) {
      setApplyError('Supabase Personal Access Token을 먼저 입력하고 저장하세요.');
      return;
    }
    setApplying(true);
    setApplyError('');
    setApplySuccess('');
    try {
      const projectRef = import.meta.env.VITE_SUPABASE_URL
        .replace('https://', '')
        .split('.')[0];

      const isCustomSmtp = !!settings.smtpHost && settings.smtpHost.trim() !== '';
      const body: Record<string, unknown> = {
        mailer_autoconfirm: settings.emailConfirmRequired !== 'true',
        enable_signup: true,
      };

      if (isCustomSmtp) {
        // 커스텀 SMTP: 입력한 SMTP 설정을 Supabase에 적용
        body.smtp_host = settings.smtpHost.trim();
        body.smtp_port = parseInt(settings.smtpPort) || 587;
        body.smtp_user = settings.smtpUser;
        body.smtp_pass = settings.smtpPass;
        body.smtp_sender_name = settings.smtpSenderName;
        body.smtp_admin_email = settings.smtpSenderEmail;
      } else {
        // Supabase 기본 메일: 기존에 설정된 커스텀 SMTP 초기화
        body.smtp_host = '';
        body.smtp_port = 587;
        body.smtp_user = '';
        body.smtp_pass = '';
        body.smtp_sender_name = '';
        body.smtp_admin_email = '';
      }

      const res = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${settings.supabaseAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `응답 오류: ${res.status}`);
      }

      setApplySuccess(
        settings.smtpHost
          ? 'Supabase에 SMTP 및 이메일 인증 설정이 적용되었습니다.'
          : 'Supabase에 이메일 인증 설정이 적용되었습니다.'
      );
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Supabase 설정 적용 중 오류가 발생했습니다.');
    } finally {
      setApplying(false);
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

        {/* freecart-web 계정 연동 */}
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-bold">freecart-web 계정 연동</h2>
          <p className="mb-4 text-xs text-gray-500">
            freecart-web 마켓플레이스와 연동하면 구매한 테마/스킨을 자동으로 설치할 수 있습니다.
          </p>
          {oauthConn ? (
            <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-green-800">연동됨</p>
                <p className="text-xs text-green-700">{oauthConn.freecartUserEmail}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  연결: {new Date(oauthConn.connectedAt).toLocaleString('ko-KR')} ·
                  만료: {new Date(oauthConn.tokenExpiresAt).toLocaleString('ko-KR')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleOAuthDisconnect}
                disabled={oauthLoading}
                className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
              >
                {oauthLoading ? '처리 중...' : '연동 해제'}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-sm text-gray-500">연동되지 않음</p>
              <button
                type="button"
                onClick={handleOAuthConnect}
                disabled={oauthLoading || !settings.storeApiUrl}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {oauthLoading ? '연동 중...' : 'freecart-web 연동하기'}
              </button>
            </div>
          )}
          {oauthMsg && (
            <p className={`mt-2 text-xs ${oauthMsg.includes('완료') || oauthMsg.includes('해제') ? 'text-green-600' : 'text-red-600'}`}>
              {oauthMsg}
            </p>
          )}
          {!settings.storeApiUrl && (
            <p className="mt-2 text-xs text-amber-600">스토어 API URL을 먼저 입력하고 저장해주세요.</p>
          )}
        </Card>

        {/* 무통장입금 설정 */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">무통장입금 설정</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-4">
              <div>
                <p className="font-medium text-gray-800">무통장입금 사용</p>
                <p className="mt-0.5 text-xs text-gray-500">PG사 없이 계좌이체로 주문 받기</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    bankTransferEnabled: prev.bankTransferEnabled === 'true' ? 'false' : 'true',
                  }))
                }
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                  settings.bankTransferEnabled === 'true' ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    settings.bankTransferEnabled === 'true' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {settings.bankTransferEnabled === 'true' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">은행명 *</label>
                  <input
                    type="text"
                    name="bankTransferBankName"
                    value={settings.bankTransferBankName}
                    onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="국민은행"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">계좌번호 *</label>
                  <input
                    type="text"
                    name="bankTransferAccountNumber"
                    value={settings.bankTransferAccountNumber}
                    onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="123-456-789012"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">예금주 *</label>
                  <input
                    type="text"
                    name="bankTransferAccountHolder"
                    value={settings.bankTransferAccountHolder}
                    onChange={handleChange}
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="홍길동"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">입금 기한 (시간)</label>
                  <input
                    type="number"
                    name="bankTransferDeadlineHours"
                    value={settings.bankTransferDeadlineHours}
                    onChange={handleChange}
                    min="1"
                    max="72"
                    className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="24"
                  />
                  <p className="mt-1 text-xs text-gray-500">주문 후 이 시간 안에 입금하지 않으면 자동 취소</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* 이메일 인증 설정 */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">이메일 인증 설정</h2>

          <div className="space-y-4">
            {/* 이메일 인증 ON/OFF */}
            <div className="flex items-center justify-between rounded-md border p-4">
              <div>
                <p className="font-medium text-gray-800">이메일 인증 필수</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  끄면 회원가입 즉시 로그인 가능 — 이메일 발송 자체가 없어 rate limit 없음
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    emailConfirmRequired: prev.emailConfirmRequired === 'true' ? 'false' : 'true',
                    smtpHost: prev.emailConfirmRequired === 'true' ? '' : prev.smtpHost,
                  }))
                }
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                  settings.emailConfirmRequired === 'true' ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    settings.emailConfirmRequired === 'true' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 이메일 인증 ON일 때만 표시 */}
            {settings.emailConfirmRequired === 'true' && (
              <div className="space-y-4 pl-1">
                {/* 발송 방식 선택 */}
                <p className="text-sm font-medium text-gray-700">인증 메일 발송 방식</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {/* Supabase 기본 */}
                  <label
                    className={`flex cursor-pointer flex-col gap-1 rounded-md border-2 p-4 transition-colors ${
                      !settings.smtpHost ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={!settings.smtpHost}
                      onChange={() =>
                        setSettings((prev) => ({
                          ...prev,
                          smtpHost: '',
                          smtpPort: '587',
                          smtpUser: '',
                          smtpPass: '',
                          smtpSenderName: '',
                          smtpSenderEmail: '',
                        }))
                      }
                    />
                    <span className="font-medium text-gray-800">Supabase 기본 메일</span>
                    <span className="text-xs text-gray-500">별도 SMTP 설정 불필요</span>
                    <span className="mt-1 inline-block rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                      ⚠ 무료 플랜: 시간당 2~3건 제한
                    </span>
                  </label>

                  {/* 커스텀 SMTP */}
                  <label
                    className={`flex cursor-pointer flex-col gap-1 rounded-md border-2 p-4 transition-colors ${
                      settings.smtpHost ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={!!settings.smtpHost}
                      onChange={() =>
                        setSettings((prev) => ({
                          ...prev,
                          smtpHost: prev.smtpHost && prev.smtpHost.trim() ? prev.smtpHost : 'smtp.',
                        }))
                      }
                    />
                    <span className="font-medium text-gray-800">커스텀 SMTP</span>
                    <span className="text-xs text-gray-500">외부 메일 서비스 직접 연결</span>
                    <span className="mt-1 inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      무료 서비스 사용 시 제한 없음
                    </span>
                  </label>
                </div>

                {/* 커스텀 SMTP 선택 시 입력 필드 */}
                {!!settings.smtpHost && (
                  <div className="rounded-md border bg-gray-50 p-4">
                    <p className="mb-3 text-xs text-gray-500">
                      무료 SMTP 추천: <strong>Resend</strong> (3,000건/월) · <strong>Brevo</strong> (300건/일) · <strong>SendGrid</strong> (100건/일)
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">SMTP 호스트 *</label>
                        <input
                          type="text"
                          name="smtpHost"
                          value={settings.smtpHost}
                          onChange={handleChange}
                          className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="smtp.resend.com"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">포트</label>
                        <input
                          type="number"
                          name="smtpPort"
                          value={settings.smtpPort}
                          onChange={handleChange}
                          className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="587"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">사용자명 *</label>
                        <input
                          type="text"
                          name="smtpUser"
                          value={settings.smtpUser}
                          onChange={handleChange}
                          className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="resend"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">비밀번호 / API Key *</label>
                        <input
                          type="password"
                          name="smtpPass"
                          value={settings.smtpPass}
                          onChange={handleChange}
                          className="w-full rounded-md border bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="re_xxxxxxxx"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">발신자 이름</label>
                        <input
                          type="text"
                          name="smtpSenderName"
                          value={settings.smtpSenderName}
                          onChange={handleChange}
                          className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="내 쇼핑몰"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">발신자 이메일</label>
                        <input
                          type="email"
                          name="smtpSenderEmail"
                          value={settings.smtpSenderEmail}
                          onChange={handleChange}
                          className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="noreply@myshop.com"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* PAT + Apply — Supabase 기본 메일 선택 시에만 표시 */}
                {!settings.smtpHost && (
                  <>
                    <div className="rounded-md border border-dashed p-4">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Supabase Personal Access Token
                      </label>
                      <input
                        type="password"
                        name="supabaseAccessToken"
                        value={settings.supabaseAccessToken}
                        onChange={handleChange}
                        className="w-full rounded-md border bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Service Role Key와 다른 계정 전용 토큰입니다.{' '}
                        <span className="font-medium text-gray-600">
                          supabase.com → 우측 상단 아이콘 → Account → Access Tokens
                        </span>
                        에서 발급 후 저장하세요.
                      </p>
                    </div>

                    {applyError && (
                      <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{applyError}</div>
                    )}
                    {applySuccess && (
                      <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-600">{applySuccess}</div>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      disabled={applying}
                      onClick={handleApplyToSupabase}
                      className="w-full md:w-auto"
                    >
                      {applying ? '적용 중...' : 'Supabase에 적용'}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* 폐쇄몰 설정 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-1">폐쇄몰 설정</h2>
          <p className="text-sm text-gray-500 mb-5">승인된 회원만 접근 가능하도록 사이트를 제한합니다.</p>

          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="font-medium text-sm">폐쇄몰 활성화</p>
              <p className="text-xs text-gray-400 mt-0.5">비활성화 시 모든 방문자가 자유롭게 접근할 수 있습니다.</p>
            </div>
            <button
              type="button"
              onClick={() => setSettings((prev) => ({ ...prev, closedMallEnabled: prev.closedMallEnabled === 'true' ? 'false' : 'true' }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                settings.closedMallEnabled === 'true' ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                settings.closedMallEnabled === 'true' ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {settings.closedMallEnabled === 'true' && (
            <div className="border rounded-xl p-4 bg-blue-50/50 space-y-3">
              <p className="text-sm font-medium text-gray-700 mb-3">비로그인/미승인 사용자를 어느 지점부터 차단할까요?</p>

              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                settings.closedMallMode === 'full' ? 'border-blue-500 bg-white' : 'border-transparent hover:bg-white/70'
              }`}>
                <input
                  type="radio"
                  name="closedMallMode"
                  value="full"
                  checked={settings.closedMallMode === 'full'}
                  onChange={() => setSettings((prev) => ({ ...prev, closedMallMode: 'full' }))}
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-800">메인 페이지부터 차단</p>
                  <p className="text-xs text-gray-500 mt-0.5">사이트에 접속하자마자 로그인이 필요합니다. 완전한 회원 전용 사이트 운영에 적합합니다.</p>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                settings.closedMallMode === 'product' ? 'border-blue-500 bg-white' : 'border-transparent hover:bg-white/70'
              }`}>
                <input
                  type="radio"
                  name="closedMallMode"
                  value="product"
                  checked={settings.closedMallMode === 'product'}
                  onChange={() => setSettings((prev) => ({ ...prev, closedMallMode: 'product' }))}
                  className="mt-0.5 accent-blue-600"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-800">상품 상세부터 차단 <span className="text-blue-600 font-normal">(권장)</span></p>
                  <p className="text-xs text-gray-500 mt-0.5">메인/카테고리/검색은 누구나 볼 수 있지만, 상품 상세 조회·장바구니·주문은 승인된 회원만 가능합니다.</p>
                </div>
              </label>

              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <strong>※ 승인 조건:</strong> 로그인 + 관리자가 회원을 직접 승인한 경우에만 접근 가능합니다.
                회원 승인은 <a href="/admin/users" className="underline hover:text-amber-900">회원 관리</a> 페이지에서 할 수 있습니다.
              </div>
            </div>
          )}
        </Card>

        <Button type="submit" disabled={submitting} className="w-full md:w-auto">
          {submitting ? '저장 중...' : '설정 저장'}
        </Button>
      </form>
    </div>
  );
}
