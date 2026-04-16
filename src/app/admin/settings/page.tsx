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
  logoUrl: string;
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
  defaultShippingNotice: string;
  defaultReturnNotice: string;
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
  // 주문·알림 이메일 설정
  notificationEmailEnabled: string; // 'true' | 'false'
  notificationFromName: string;
  notificationFromEmail: string;
  resendApiKey: string;
  emailProvider: string; // 'resend' | 'smtp'
  // 폐쇄몰 설정
  closedMallEnabled: string; // 'true' | 'false'
  closedMallMode: string;    // 'full' | 'product'
}

const defaultSettings: Settings = {
  siteName: '',
  logoUrl: '',
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
  defaultShippingNotice: '',
  defaultReturnNotice: '',
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
  notificationEmailEnabled: 'true',
  notificationFromName: '',
  notificationFromEmail: '',
  resendApiKey: '',
  emailProvider: 'resend',
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
  logoUrl: 'site_logo',
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
  defaultShippingNotice: 'default_shipping_notice',
  defaultReturnNotice: 'default_return_notice',
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
  notificationEmailEnabled: 'notification_email_enabled',
  notificationFromName: 'notification_from_name',
  notificationFromEmail: 'notification_from_email',
  resendApiKey: 'resend_api_key',
  emailProvider: 'email_provider',
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

const SMTP_PROVIDERS = [
  {
    id: 'mailgun',
    label: 'Mailgun',
    host: 'smtp.mailgun.org',
    port: '587',
    userPlaceholder: 'postmaster@mg.yourdomain.com',
    passPlaceholder: 'SMTP 비밀번호',
    guide: 'Mailgun → Sending → Domain Settings → SMTP credentials에서 사용자명/비밀번호 확인',
  },
  {
    id: 'gmail',
    label: 'Gmail',
    host: 'smtp.gmail.com',
    port: '587',
    userPlaceholder: 'your@gmail.com',
    passPlaceholder: '앱 비밀번호 (일반 비밀번호 아님)',
    guide: 'Google 계정 → 보안 → 2단계 인증 ON → 앱 비밀번호 생성 후 입력',
  },
  {
    id: 'outlook',
    label: 'Outlook / Microsoft 365',
    host: 'smtp.office365.com',
    port: '587',
    userPlaceholder: 'your@outlook.com',
    passPlaceholder: 'Microsoft 계정 비밀번호',
    guide: 'Outlook → 설정 → 메일 → POP 및 IMAP → SMTP 허용 ON',
  },
  {
    id: 'naver',
    label: '네이버',
    host: 'smtp.naver.com',
    port: '587',
    userPlaceholder: 'your@naver.com',
    passPlaceholder: '네이버 로그인 비밀번호',
    guide: '네이버 메일 → 환경설정 → POP3/SMTP 설정 → SMTP 사용 ON',
  },
  {
    id: 'daum',
    label: '다음 (Kakao)',
    host: 'smtp.daum.net',
    port: '465',
    userPlaceholder: 'your@daum.net',
    passPlaceholder: '카카오 계정 비밀번호',
    guide: '다음 메일 → 환경설정 → 외부메일 → SMTP 허용 ON',
  },
  {
    id: 'nate',
    label: '네이트',
    host: 'smtp.nate.com',
    port: '465',
    userPlaceholder: 'your@nate.com',
    passPlaceholder: '네이트 로그인 비밀번호',
    guide: '네이트 메일 → 환경설정 → 메일설정 → SMTP 사용 허용 ON',
  },
  {
    id: 'custom',
    label: '사용자 지정 SMTP 서버',
    host: '',
    port: '587',
    userPlaceholder: '사용자명',
    passPlaceholder: '비밀번호',
    guide: null,
  },
] as const;

type SmtpProviderId = (typeof SMTP_PROVIDERS)[number]['id'];

export default function AdminSettingsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [applyingSmtp, setApplyingSmtp] = useState(false);
  const [applyingEmailConfirm, setApplyingEmailConfirm] = useState(false);
  const [smtpProvider, setSmtpProvider] = useState<SmtpProviderId>('custom');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [applyError, setApplyError] = useState('');
  const [applySuccess, setApplySuccess] = useState('');

  // system_settings 상태
  const [requireSignupApproval, setRequireSignupApproval] = useState(false);
  const [enableUserAssignment, setEnableUserAssignment] = useState(false);
  const [enableUserTags, setEnableUserTags] = useState(false);
  const [useUserLevels, setUseUserLevels] = useState(false);
  const [usePoints, setUsePoints] = useState(false);
  const [pointLabel, setPointLabel] = useState('포인트');
  const [useDeposit, setUseDeposit] = useState(false);
  const [allowCustomerReturn,   setAllowCustomerReturn]   = useState(true);
  const [allowCustomerExchange, setAllowCustomerExchange] = useState(true);

  const [useSubscriptions, setUseSubscriptions] = useState(false);
  const [useCoupons, setUseCoupons] = useState(true);
  const [useBulkShipment, setUseBulkShipment] = useState(true);
  const [notifyOutForDelivery, setNotifyOutForDelivery] = useState(true);
  const [noticeBarEnabled, setNoticeBarEnabled] = useState(true);
  const [noticeBarColor, setNoticeBarColor] = useState('#2563eb');
  const [imageBannerEnabled, setImageBannerEnabled] = useState(true);

  // 주문 목록 기본 컬럼 설정
  const [orderListColumns, setOrderListColumns] = useState<string[]>(['product', 'memo', 'deadline']);

  // 로고 업로드 상태
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [logoUploading, setLogoUploading] = useState(false);

  // 테스트 이메일 발송 상태
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailMsg, setTestEmailMsg] = useState('');

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
      if (loaded.logoUrl) setLogoPreview(loaded.logoUrl);

      // system_settings 일괄 로드
      const { data: sysRows } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['require_signup_approval', 'enable_user_assignment', 'enable_user_tags', 'use_user_levels', 'use_points', 'point_label', 'allow_customer_return', 'allow_customer_exchange', 'order_list_columns', 'notice_bar_enabled', 'notice_bar_color', 'image_banner_enabled', 'use_subscriptions', 'use_coupons', 'use_deposit', 'use_bulk_shipment', 'notify_out_for_delivery']);
      for (const row of sysRows ?? []) {
        if (row.key === 'require_signup_approval') setRequireSignupApproval(row.value === true);
        if (row.key === 'enable_user_assignment') setEnableUserAssignment(row.value === true);
        if (row.key === 'enable_user_tags') setEnableUserTags(row.value === true);
        if (row.key === 'use_user_levels') setUseUserLevels(row.value === true);
        if (row.key === 'use_points') setUsePoints(row.value === true);
        if (row.key === 'point_label' && typeof row.value === 'string') setPointLabel(row.value);
        if (row.key === 'use_deposit') setUseDeposit(row.value === true);
        if (row.key === 'allow_customer_return')   setAllowCustomerReturn(row.value !== false);
        if (row.key === 'allow_customer_exchange') setAllowCustomerExchange(row.value !== false);
        if (row.key === 'order_list_columns' && Array.isArray(row.value)) setOrderListColumns(row.value as string[]);
        if (row.key === 'notice_bar_enabled') setNoticeBarEnabled(row.value !== false);
        if (row.key === 'notice_bar_color' && typeof row.value === 'string') setNoticeBarColor(row.value);
        if (row.key === 'image_banner_enabled') setImageBannerEnabled(row.value !== false);
        if (row.key === 'use_subscriptions') setUseSubscriptions(row.value === true);
        if (row.key === 'use_coupons') setUseCoupons(row.value !== false);
        if (row.key === 'use_bulk_shipment') setUseBulkShipment(row.value !== false);
        if (row.key === 'notify_out_for_delivery') setNotifyOutForDelivery(row.value !== false);
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

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleLogoRemove() {
    setLogoFile(null);
    setLogoPreview('');
    setSettings((prev) => ({ ...prev, logoUrl: '' }));
  }

  async function uploadLogoImage(file: File): Promise<string> {
    const supabase = createClient();
    const ext = file.name.split('.').pop() || 'png';
    const path = `logo.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from('logos').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const supabase = createClient();

      // 로고 파일이 선택된 경우 먼저 업로드
      if (logoFile) {
        setLogoUploading(true);
        try {
          const url = await uploadLogoImage(logoFile);
          setSettings((prev) => ({ ...prev, logoUrl: url }));
          setLogoFile(null);
          setLogoPreview('');
          // keyMap 순회 전에 settings를 직접 갱신해야 하므로 임시로 반영
          (settings as any).logoUrl = url;
        } finally {
          setLogoUploading(false);
        }
      }

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

      // system_settings 일괄 저장
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const sysUpdates = [
        { key: 'require_signup_approval', value: requireSignupApproval },
        { key: 'enable_user_assignment', value: enableUserAssignment },
        { key: 'enable_user_tags', value: enableUserTags },
        { key: 'use_user_levels', value: useUserLevels },
        { key: 'use_points', value: usePoints },
        { key: 'point_label', value: pointLabel },
        { key: 'use_deposit', value: useDeposit },
        { key: 'allow_customer_return',   value: allowCustomerReturn },
        { key: 'allow_customer_exchange', value: allowCustomerExchange },
        { key: 'order_list_columns', value: orderListColumns },
        { key: 'notice_bar_enabled', value: noticeBarEnabled },
        { key: 'notice_bar_color', value: noticeBarColor },
        { key: 'image_banner_enabled', value: imageBannerEnabled },
        { key: 'use_subscriptions', value: useSubscriptions },
        { key: 'use_coupons', value: useCoupons },
        { key: 'use_bulk_shipment', value: useBulkShipment },
        { key: 'notify_out_for_delivery', value: notifyOutForDelivery },
      ];
      for (const { key, value } of sysUpdates) {
        const { error: sysError } = await supabase
          .from('system_settings')
          .upsert({ key, value, updated_by: authUser?.id ?? null }, { onConflict: 'key' });
        if (sysError) throw sysError;
      }

      invalidateSettingsCache();
      setSuccess('설정이 저장되었습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '설정 저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTestEmail() {
    setTestEmailSending(true);
    setTestEmailMsg('');
    try {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('로그인 정보를 확인할 수 없습니다.');
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          userId:      authUser.id,
          subject:     '[프리카트] 이메일 발송 테스트',
          content:     '이 메일은 이메일 발송 설정 테스트입니다.',
          htmlContent: '<p style="font-family:sans-serif;color:#333;">이 메일은 <strong>이메일 발송 설정 테스트</strong>입니다. 정상적으로 수신되었다면 설정이 완료된 것입니다.</p>',
          template:    'test',
        },
      });
      if (error) throw new Error(error.message || '발송 실패');
      setTestEmailMsg('테스트 메일이 발송되었습니다. 받은편지함을 확인해 주세요.');
    } catch (err) {
      setTestEmailMsg(err instanceof Error ? err.message : '발송 실패');
    } finally {
      setTestEmailSending(false);
    }
  }

  function getProjectRef() {
    return import.meta.env.VITE_SUPABASE_URL.replace('https://', '').split('.')[0];
  }

  async function callSupabaseAuthApi(body: Record<string, unknown>) {
    if (!settings.supabaseAccessToken) {
      throw new Error('Supabase Personal Access Token을 먼저 입력하고 저장하세요.');
    }
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${getProjectRef()}/config/auth`,
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
  }

  // SMTP 설정만 Supabase Auth에 적용 (이메일 인증 여부는 건드리지 않음)
  async function handleApplySmtp() {
    setApplyingSmtp(true);
    setApplyError('');
    setApplySuccess('');
    try {
      if (!settings.smtpHost.trim()) {
        throw new Error('SMTP 호스트를 입력해주세요.');
      }
      await callSupabaseAuthApi({
        smtp_host:        settings.smtpHost.trim(),
        smtp_port:        parseInt(settings.smtpPort) || 587,
        smtp_user:        settings.smtpUser,
        smtp_pass:        settings.smtpPass,
        smtp_sender_name: settings.smtpSenderName,
        smtp_admin_email: settings.smtpSenderEmail,
      });
      setApplySuccess('SMTP 설정이 Supabase에 적용되었습니다. 비밀번호 재설정 등 인증 메일이 이 SMTP를 통해 발송됩니다.');
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'SMTP 적용 중 오류가 발생했습니다.');
    } finally {
      setApplyingSmtp(false);
    }
  }

  // 이메일 인증 필수 여부만 Supabase Auth에 적용 (SMTP는 건드리지 않음)
  async function handleApplyEmailConfirm() {
    setApplyingEmailConfirm(true);
    setApplyError('');
    setApplySuccess('');
    try {
      await callSupabaseAuthApi({
        mailer_autoconfirm: settings.emailConfirmRequired !== 'true',
        enable_signup: true,
      });
      setApplySuccess(
        settings.emailConfirmRequired === 'true'
          ? '이메일 인증 필수로 설정되었습니다.'
          : '이메일 인증 없이 즉시 로그인 가능하도록 설정되었습니다.'
      );
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : '이메일 인증 설정 적용 중 오류가 발생했습니다.');
    } finally {
      setApplyingEmailConfirm(false);
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

            {/* 로고 이미지 업로드 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">로고 이미지</label>
              <p className="mb-2 text-xs text-gray-500">권장 크기: 가로 160px × 세로 50px. 미등록 시 사이트 이름이 텍스트로 표시됩니다.</p>
              {/* 미리보기 영역 (고정 크기 160×50) */}
              <div className="mb-3 flex items-center gap-4">
                <div className="flex h-[50px] w-[160px] items-center justify-center overflow-hidden rounded border bg-gray-50">
                  {logoPreview ? (
                    <img src={logoPreview} alt="로고 미리보기" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs text-gray-400">미리보기</span>
                  )}
                </div>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={handleLogoRemove}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                  >
                    로고 삭제
                  </button>
                )}
              </div>
              <label className="inline-block cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                {logoUploading ? '업로드 중...' : '이미지 선택'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  className="hidden"
                  disabled={logoUploading}
                />
              </label>
              {logoFile && (
                <span className="ml-2 text-xs text-gray-500">{logoFile.name}</span>
              )}
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

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">기본 배송 안내</label>
              <p className="mb-1 text-xs text-gray-500">상품별 안내가 없을 때 표시됩니다. HTML 태그 사용 가능.</p>
              <textarea
                name="defaultShippingNotice"
                value={settings.defaultShippingNotice}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={"배송 기간: 결제 후 1~3 영업일 이내 출고됩니다.\n기본 배송비: 3,000원 (50,000원 이상 구매 시 무료)"}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">기본 환불·교환 안내</label>
              <p className="mb-1 text-xs text-gray-500">상품별 안내가 없을 때 표시됩니다. HTML 태그 사용 가능.</p>
              <textarea
                name="defaultReturnNotice"
                value={settings.defaultReturnNotice}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={"교환/반품 신청 기간: 상품 수령 후 7일 이내\n상품 불량·오배송 시: 무료 교환 또는 전액 환불"}
              />
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

        {/* 주문·알림 이메일 설정 */}
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-bold">주문·알림 이메일</h2>
          <p className="mb-4 text-xs text-gray-500">주문 완료, 배송 시작, 취소 등 트랜잭션 이메일을 고객에게 자동 발송합니다.</p>

          <div className="space-y-4">
            {/* 이메일 알림 ON/OFF */}
            <div className="flex items-center justify-between rounded-md border p-4">
              <div>
                <p className="font-medium text-gray-800">이메일 알림 발송</p>
                <p className="mt-0.5 text-xs text-gray-500">끄면 모든 트랜잭션 이메일 발송이 중단됩니다.</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    notificationEmailEnabled: prev.notificationEmailEnabled === 'true' ? 'false' : 'true',
                  }))
                }
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                  settings.notificationEmailEnabled === 'true' ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    settings.notificationEmailEnabled === 'true' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {settings.notificationEmailEnabled === 'true' && (
              <div className="space-y-4 pl-1">
                {/* 발신자 정보 */}
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">발신자 이름</label>
                    <input
                      type="text"
                      name="notificationFromName"
                      value={settings.notificationFromName}
                      onChange={handleChange}
                      className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="프리카트"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">발신 이메일</label>
                    <input
                      type="email"
                      name="notificationFromEmail"
                      value={settings.notificationFromEmail}
                      onChange={handleChange}
                      className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="noreply@myshop.com"
                    />
                  </div>
                </div>

                {/* 발송 방식 */}
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700">발송 방식</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label
                      className={`flex cursor-pointer flex-col gap-1 rounded-md border-2 p-4 transition-colors ${
                        settings.emailProvider !== 'smtp' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        checked={settings.emailProvider !== 'smtp'}
                        onChange={() => setSettings((prev) => ({ ...prev, emailProvider: 'resend' }))}
                      />
                      <span className="font-medium text-gray-800">Resend API</span>
                      <span className="text-xs text-gray-500">API Key로 직접 발송 (권장)</span>
                      <span className="mt-1 inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        무료 3,000건/월
                      </span>
                    </label>
                    <label
                      className={`flex cursor-pointer flex-col gap-1 rounded-md border-2 p-4 transition-colors ${
                        settings.emailProvider === 'smtp' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        checked={settings.emailProvider === 'smtp'}
                        onChange={() => setSettings((prev) => ({ ...prev, emailProvider: 'smtp' }))}
                      />
                      <span className="font-medium text-gray-800">SMTP</span>
                      <span className="text-xs text-gray-500">아래 '이메일 인증 설정'의 SMTP 공유</span>
                    </label>
                  </div>
                </div>

                {/* Resend API Key 입력 */}
                {settings.emailProvider !== 'smtp' && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Resend API Key</label>
                    <input
                      type="password"
                      name="resendApiKey"
                      value={settings.resendApiKey}
                      onChange={handleChange}
                      className="w-full rounded-md border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      resend.com에서 발급한 API Key를 입력하세요.
                    </p>
                  </div>
                )}

                {/* SMTP 선택 시 안내 */}
                {settings.emailProvider === 'smtp' && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                    아래 <strong>'이메일 인증 설정'</strong> 섹션에서 입력한 SMTP 정보가 트랜잭션 이메일에도 함께 사용됩니다.
                    SMTP 호스트·포트·계정 정보를 해당 섹션에서 설정해 주세요.
                  </div>
                )}

                {/* 테스트 발송 */}
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={testEmailSending}
                    onClick={handleTestEmail}
                    className="w-full md:w-auto"
                  >
                    {testEmailSending ? '발송 중...' : '테스트 메일 발송'}
                  </Button>
                  {testEmailMsg && (
                    <p className={`text-sm ${testEmailMsg.includes('발송되었습니다') ? 'text-green-600' : 'text-red-600'}`}>
                      {testEmailMsg}
                    </p>
                  )}
                </div>
                <p className="text-xs text-gray-400">현재 로그인한 관리자 이메일로 테스트 메일을 발송합니다. 설정 저장 후 테스트하세요.</p>
              </div>
            )}
          </div>
        </Card>

        {/* 이메일 인증 설정 */}
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-bold">SMTP 설정</h2>
          <p className="mb-4 text-sm text-gray-500">비밀번호 재설정, 주문 알림 등 모든 이메일 발송에 사용됩니다. 이메일 인증 여부와 무관하게 설정할 수 있습니다.</p>

          <div className="space-y-4">
            {/* 프로바이더 선택 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">메일 서비스 선택</label>
              <select
                value={smtpProvider}
                onChange={(e) => {
                  const id = e.target.value as SmtpProviderId;
                  const p = SMTP_PROVIDERS.find((p) => p.id === id)!;
                  setSmtpProvider(id);
                  setSettings((prev) => ({
                    ...prev,
                    smtpHost: p.host,
                    smtpPort: p.port,
                  }));
                }}
                className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SMTP_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* 선택한 프로바이더 안내 */}
            {(() => {
              const p = SMTP_PROVIDERS.find((p) => p.id === smtpProvider);
              return p?.guide ? (
                <div className="rounded-md bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700">
                  ℹ {p.guide}
                </div>
              ) : null;
            })()}

            {/* 입력 필드 */}
            <div className="rounded-md border bg-gray-50 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">SMTP 호스트</label>
                  <input
                    type="text"
                    name="smtpHost"
                    value={settings.smtpHost}
                    onChange={handleChange}
                    className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="smtp.example.com"
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
                  <label className="mb-1 block text-xs font-medium text-gray-600">사용자명</label>
                  <input
                    type="text"
                    name="smtpUser"
                    value={settings.smtpUser}
                    onChange={handleChange}
                    className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={SMTP_PROVIDERS.find((p) => p.id === smtpProvider)?.userPlaceholder ?? '사용자명'}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">비밀번호 / API Key</label>
                  <input
                    type="password"
                    name="smtpPass"
                    value={settings.smtpPass}
                    onChange={handleChange}
                    className="w-full rounded-md border bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={SMTP_PROVIDERS.find((p) => p.id === smtpProvider)?.passPlaceholder ?? '비밀번호'}
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

            {/* PAT */}
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
                Supabase Auth 이메일에 SMTP를 적용할 때 필요합니다.{' '}
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
              disabled={applyingSmtp}
              onClick={handleApplySmtp}
              className="w-full md:w-auto"
            >
              {applyingSmtp ? '적용 중...' : 'Supabase에 SMTP 적용'}
            </Button>
          </div>
        </Card>

        {/* 이메일 인증 설정 */}
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-bold">이메일 인증 설정</h2>
          <p className="mb-4 text-sm text-gray-500">회원가입 시 이메일 인증 필수 여부를 설정합니다. SMTP 설정과 독립적으로 동작합니다.</p>

          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-4">
              <div>
                <p className="font-medium text-gray-800">이메일 인증 필수</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  끄면 회원가입 즉시 로그인 가능 — 쇼핑몰은 보통 OFF로 운영
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    emailConfirmRequired: prev.emailConfirmRequired === 'true' ? 'false' : 'true',
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

            <Button
              type="button"
              variant="outline"
              disabled={applyingEmailConfirm}
              onClick={handleApplyEmailConfirm}
              className="w-full md:w-auto"
            >
              {applyingEmailConfirm ? '적용 중...' : '이메일 인증 설정 적용'}
            </Button>
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
              onClick={() => {
                const turningOn = settings.closedMallEnabled !== 'true';
                setSettings((prev) => ({ ...prev, closedMallEnabled: turningOn ? 'true' : 'false' }));
                if (turningOn) setRequireSignupApproval(true);
              }}
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
                <strong>※ 승인 조건:</strong> 폐쇄몰 활성화 시 아래 '회원 가입 설정'의 관리자 승인 기능이 자동으로 켜집니다.
                회원 승인은 <a href="/admin/users" className="underline hover:text-amber-900">회원 관리</a> 페이지에서 할 수 있습니다.
              </div>
            </div>
          )}
        </Card>

        {/* 회원 가입 설정 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-1">회원 가입 설정</h2>
          <p className="text-sm text-gray-500 mb-5">가입 후 로그인 허용 방식을 설정합니다.</p>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">회원가입 시 관리자 승인 필요</p>
              <p className="text-xs text-gray-400 mt-0.5">켜면 가입 후 관리자가 직접 승인해야 로그인할 수 있습니다.</p>
              {settings.closedMallEnabled === 'true' && (
                <span className="inline-block mt-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
                  폐쇄몰 활성화로 자동 설정됨
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setRequireSignupApproval((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                requireSignupApproval ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                requireSignupApproval ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </Card>

        {/* 기능 설정 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-1">기능 설정</h2>
          <p className="text-sm text-gray-500 mb-5">사이트에서 사용할 기능을 켜거나 끕니다.</p>

          <div className="space-y-6">
            {/* 공지 배너 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">공지 배너 표시</p>
                  <p className="text-xs text-gray-400 mt-0.5">켜면 메인 페이지 상단에 최신 공지 1개를 배너로 표시합니다.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNoticeBarEnabled((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    noticeBarEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    noticeBarEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* 배너 색상 */}
              <div className={`flex items-center gap-3 transition-opacity ${!noticeBarEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                <label className="text-xs text-gray-500 shrink-0">배너 색상</label>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="color"
                    value={noticeBarColor}
                    onChange={(e) => setNoticeBarColor(e.target.value)}
                    className="h-8 w-10 rounded border border-gray-200 cursor-pointer p-0.5"
                    title="배너 배경색 선택"
                  />
                  <input
                    type="text"
                    value={noticeBarColor}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^#([0-9a-fA-F]{0,6})$/.test(v)) setNoticeBarColor(v);
                    }}
                    maxLength={7}
                    placeholder="#2563eb"
                    className="w-28 rounded-md border px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {/* 미리보기 */}
                  <div
                    className="flex-1 rounded-md px-3 py-1.5 text-white text-xs font-medium truncate"
                    style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(noticeBarColor) ? noticeBarColor : '#2563eb' }}
                  >
                    공지사항 미리보기
                  </div>
                  <button
                    type="button"
                    onClick={() => setNoticeBarColor('#2563eb')}
                    className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                  >
                    초기화
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t" />

            {/* 이미지 배너 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">이미지 배너 표시</p>
                <p className="text-xs text-gray-400 mt-0.5">켜면 메인 페이지에 배너 관리에서 등록한 활성 이미지 배너를 표시합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setImageBannerEnabled((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  imageBannerEnabled ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  imageBannerEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="border-t" />

            {/* 담당자 기능 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">담당자 기능 사용</p>
                <p className="text-xs text-gray-400 mt-0.5">켜면 담당자가 배정되지 않은 일반 관리자는 사용자/주문에 접근할 수 없습니다.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!enableUserAssignment && !confirm('담당자 기능을 켜면 담당자가 배정되지 않은 일반 관리자는 사용자/주문에 접근할 수 없게 됩니다. 계속하시겠습니까?')) return;
                  setEnableUserAssignment((prev) => !prev);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  enableUserAssignment ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  enableUserAssignment ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="border-t" />

            {/* 사용자 태그 기능 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">사용자 태그 기능 사용</p>
                <p className="text-xs text-gray-400 mt-0.5">켜면 회원 관리에서 태그 사이드바 및 태그 관리 탭이 표시됩니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setEnableUserTags((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  enableUserTags ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  enableUserTags ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="border-t" />

            {/* 회원 등급 기능 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">회원 등급 기능 사용</p>
                <p className="text-xs text-gray-400 mt-0.5">끄면 관리자 회원 관리 화면에서 등급 컬럼/변경 UI가 숨겨집니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setUseUserLevels((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  useUserLevels ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  useUserLevels ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="border-t" />

            {/* 포인트 기능 */}
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">포인트 기능 사용</p>
                  <p className="text-xs text-gray-400 mt-0.5">끄면 회원 관리 화면에서 포인트 관련 UI가 숨겨집니다.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setUsePoints((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    usePoints ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    usePoints ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className={`space-y-4 transition-opacity ${!usePoints ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">포인트 명칭</label>
                    <input
                      type="text"
                      value={pointLabel}
                      onChange={(e) => setPointLabel(e.target.value)}
                      disabled={!usePoints}
                      className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                      placeholder="포인트"
                    />
                    <p className="mt-1 text-xs text-gray-500">UI에 표시되는 명칭 (예: 포인트, 적립금, 마일리지)</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">기본 적립률 (%)</label>
                    <input type="number" name="pointEarnRate" value={settings.pointEarnRate} onChange={handleChange} min="0" max="100" step="0.1" disabled={!usePoints} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed" placeholder="1" />
                    <p className="mt-1 text-xs text-gray-500">구매금액 대비 포인트 적립 비율</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">회원가입 포인트 (P)</label>
                    <input type="number" name="signupPoints" value={settings.signupPoints} onChange={handleChange} min="0" disabled={!usePoints} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed" placeholder="1000" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">최소 보유 포인트 (사용 기준)</label>
                    <input type="number" name="pointsMinThreshold" value={settings.pointsMinThreshold} onChange={handleChange} min="0" disabled={!usePoints} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed" placeholder="1000" />
                    <p className="mt-1 text-xs text-gray-500">이 금액 이상 보유 시 포인트 사용 가능</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">사용 단위 (원)</label>
                    <input type="number" name="pointsUnitAmount" value={settings.pointsUnitAmount} onChange={handleChange} min="1" disabled={!usePoints} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed" placeholder="100" />
                    <p className="mt-1 text-xs text-gray-500">포인트 사용 최소 단위</p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">최대 사용 비율 (%)</label>
                    <input type="number" name="pointsMaxUsagePercent" value={settings.pointsMaxUsagePercent} onChange={handleChange} min="1" max="100" disabled={!usePoints} className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed" placeholder="50" />
                    <p className="mt-1 text-xs text-gray-500">결제금액의 몇 %까지 포인트로 결제 가능</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t" />

            {/* 예치금 기능 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">예치금 기능 사용</p>
                <p className="text-xs text-gray-400 mt-0.5">켜면 사이드바에 예치금 관리 메뉴가 표시됩니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setUseDeposit((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  useDeposit ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  useDeposit ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="border-t" />

            {/* 반품/교환 신청 설정 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">고객 반품 신청 허용</p>
                <p className="text-xs text-gray-400 mt-0.5">끄면 마이페이지 반품 신청 폼 대신 고객센터 문의 안내가 표시됩니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setAllowCustomerReturn((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  allowCustomerReturn ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  allowCustomerReturn ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="border-t" />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">고객 교환 신청 허용</p>
                <p className="text-xs text-gray-400 mt-0.5">끄면 마이페이지 교환 신청 폼 대신 고객센터 문의 안내가 표시됩니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setAllowCustomerExchange((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  allowCustomerExchange ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  allowCustomerExchange ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="border-t" />

            {/* 정기배송 사용 설정 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">정기배송 기능 사용</p>
                <p className="text-xs text-gray-400 mt-0.5">켜면 관리자 주문 관리 메뉴에 정기배송 탭이 표시되고, 사용자가 정기배송을 신청할 수 있습니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setUseSubscriptions((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  useSubscriptions ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  useSubscriptions ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="border-t" />

            {/* 쿠폰 기능 사용 설정 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">쿠폰 기능 사용</p>
                <p className="text-xs text-gray-400 mt-0.5">끄면 관리자 프로모션 메뉴의 쿠폰 항목과 마이페이지의 쿠폰 메뉴가 숨겨집니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setUseCoupons((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  useCoupons ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  useCoupons ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="border-t" />

            {/* 일괄배송 기능 사용 설정 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">일괄배송 기능 사용</p>
                <p className="text-xs text-gray-400 mt-0.5">끄면 관리자 주문 관리 메뉴에서 일괄 발송 메뉴가 숨겨집니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setUseBulkShipment((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  useBulkShipment ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  useBulkShipment ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">배송 출발 시 고객 알림 발송</p>
                <p className="text-xs text-gray-400 mt-0.5">굿스플로 '배송 출발(DLV_START)' 이벤트 수신 시 고객에게 알림을 발송합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setNotifyOutForDelivery((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  notifyOutForDelivery ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  notifyOutForDelivery ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="border-t" />

            {/* 주문 목록 기본 컬럼 설정 */}
            <div>
              <p className="font-medium text-sm mb-1">주문 목록 기본 표시 항목</p>
              <p className="text-xs text-gray-400 mb-3">관리자가 처음 접속했을 때 표시될 기본 컬럼을 선택합니다. 각 관리자는 개인적으로 변경할 수 있습니다.</p>
              <div className="space-y-2">
                {([
                  { key: 'product',   label: '상품 요약',   desc: '독립 컬럼' },
                  { key: 'recipient', label: '수령인',      desc: '독립 컬럼' },
                  { key: 'address',   label: '배송주소',    desc: '독립 컬럼' },
                  { key: 'discount',  label: '할인/배송비', desc: '독립 컬럼' },
                  { key: 'memo',     label: '메모 아이콘',  desc: '결제금액 셀 내 표시' },
                  { key: 'deadline', label: '입금마감',     desc: '주문상태 셀 내 표시' },
                ] as const).map(({ key, label, desc }) => {
                  const on = orderListColumns.includes(key);
                  return (
                    <div key={key} className="flex items-center justify-between py-1">
                      <div>
                        <span className="text-sm">{label}</span>
                        <span className="ml-2 text-xs text-gray-400">{desc}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setOrderListColumns((prev) =>
                            on ? prev.filter((k) => k !== key) : [...prev, key],
                          )
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                          on ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          on ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  );
                })}
              </div>
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
