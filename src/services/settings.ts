import { createClient } from '@/lib/supabase/client';

/** settings 테이블에서 읽어온 값을 캐싱합니다. */
let cache: Record<string, string> = {};
let cacheLoaded = false;
let cachePromise: Promise<void> | null = null;

/** 전체 settings를 한번에 로드하여 캐싱 */
async function ensureLoaded(): Promise<void> {
  if (cacheLoaded) return;
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.from('settings').select('key, value');
      cache = {};
      (data || []).forEach((s: any) => {
        cache[s.key] = s.value;
      });
      cacheLoaded = true;
    } catch {
      // DB 연결 실패 시 빈 캐시 사용 (기본값 적용)
      cacheLoaded = true;
    } finally {
      cachePromise = null;
    }
  })();

  return cachePromise;
}

function parseValue(raw: string | undefined): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return String(parsed);
  } catch {
    return raw;
  }
}

/** 캐시를 강제로 리로드합니다. 관리자가 설정 변경 후 호출. */
export function invalidateSettingsCache(): void {
  cacheLoaded = false;
  cache = {};
  window.dispatchEvent(new CustomEvent('freecart:settings-changed'));
}

/** 단일 설정 값을 문자열로 가져옵니다. */
export async function getSetting(key: string, defaultValue = ''): Promise<string> {
  await ensureLoaded();
  const raw = cache[key];
  return raw ? parseValue(raw) : defaultValue;
}

/** 단일 설정 값을 숫자로 가져옵니다. */
export async function getSettingNumber(key: string, defaultValue = 0): Promise<number> {
  const val = await getSetting(key);
  if (!val) return defaultValue;
  const num = Number(val);
  return isNaN(num) ? defaultValue : num;
}

/** 여러 설정 값을 한번에 가져옵니다. */
export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  await ensureLoaded();
  const result: Record<string, string> = {};
  for (const key of keys) {
    result[key] = cache[key] ? parseValue(cache[key]) : '';
  }
  return result;
}

/** 설정을 저장합니다 (upsert). */
export async function saveSetting(key: string, value: string | number | boolean): Promise<void> {
  const supabase = createClient();
  await supabase
    .from('settings')
    .upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' });
  // 캐시 무효화
  cache[key] = JSON.stringify(value);
}

// ============================================================================
// 비즈니스 설정 헬퍼 함수 (하드코딩 제거용)
// ============================================================================

/** 배송비 설정 */
export async function getShippingSettings(): Promise<{
  shippingFee: number;
  freeShippingThreshold: number;
}> {
  await ensureLoaded();
  return {
    shippingFee: Number(parseValue(cache['shipping_fee'])) || 3000,
    freeShippingThreshold: Number(parseValue(cache['free_shipping_threshold'])) || 50000,
  };
}

/** 포인트 정책 설정 */
export async function getPointSettings(): Promise<{
  earnRate: number;
  signupPoints: number;
  minThreshold: number;
  unitAmount: number;
  maxUsagePercent: number;
}> {
  await ensureLoaded();
  return {
    earnRate: Number(parseValue(cache['point_earn_rate'])) || 1,
    signupPoints: Number(parseValue(cache['signup_points'])) || 1000,
    minThreshold: Number(parseValue(cache['points_min_threshold'])) || 1000,
    unitAmount: Number(parseValue(cache['points_unit_amount'])) || 100,
    maxUsagePercent: Number(parseValue(cache['points_max_usage_percent'])) || 50,
  };
}

/** 사이트 기본 정보 */
export async function getBankTransferSettings(): Promise<{
  enabled: boolean;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  depositDeadlineHours: number;
}> {
  await ensureLoaded();
  return {
    enabled: parseValue(cache['bank_transfer_enabled']) === 'true',
    bankName: parseValue(cache['bank_transfer_bank_name']) || '',
    accountNumber: parseValue(cache['bank_transfer_account_number']) || '',
    accountHolder: parseValue(cache['bank_transfer_account_holder']) || '',
    depositDeadlineHours: Number(parseValue(cache['bank_transfer_deadline_hours'])) || 24,
  };
}

/** 폐쇄몰 설정 */
export async function getPrivateMallSettings(): Promise<{
  enabled: boolean;
  mode: 'full' | 'product';
}> {
  await ensureLoaded();
  return {
    enabled: parseValue(cache['closed_mall_enabled']) === 'true',
    mode: (parseValue(cache['closed_mall_mode']) as 'full' | 'product') || 'product',
  };
}

export async function getSiteInfo(): Promise<{
  siteName: string;
  logoUrl: string;
  siteDescription: string;
  companyName: string;
  companyCeo: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyBusinessNumber: string;
  githubUrl: string;
  storeApiUrl: string;
  naverClientId: string;
}> {
  await ensureLoaded();
  return {
    siteName: parseValue(cache['site_name']) || 'Freecart',
    logoUrl: parseValue(cache['site_logo']) || '',
    siteDescription: parseValue(cache['site_description']) || '무료 오픈소스 쇼핑몰 솔루션',
    companyName: parseValue(cache['company_name']) || '',
    companyCeo: parseValue(cache['company_ceo']) || '',
    companyAddress: parseValue(cache['company_address']) || '',
    companyPhone: parseValue(cache['company_phone']) || '',
    companyEmail: parseValue(cache['company_email']) || '',
    companyBusinessNumber: parseValue(cache['company_business_number']) || '',
    githubUrl: parseValue(cache['github_url']) || '',
    storeApiUrl: parseValue(cache['store_api_url']) || 'https://freecart.kr',
    naverClientId: parseValue(cache['naver_client_id']) || '',
  };
}

/** 고객 환불/교환/취소 직접 신청 허용 여부 조회 */
export async function getCustomerRequestSettings(): Promise<{
  allowCustomerReturn:   boolean;
  allowCustomerExchange: boolean;
  allowCustomerCancel:   boolean;
}> {
  const supabase = createClient();
  const { data } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['allow_customer_return', 'allow_customer_exchange', 'allow_customer_cancel']);

  const map = new Map((data ?? []).map((r: any) => [r.key, r.value]));
  return {
    allowCustomerReturn:   (map.get('allow_customer_return')   ?? true) !== false,
    allowCustomerExchange: (map.get('allow_customer_exchange') ?? true) !== false,
    allowCustomerCancel:   (map.get('allow_customer_cancel')   ?? true) !== false,
  };
}
