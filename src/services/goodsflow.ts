import { createClient } from '@/lib/supabase/client';
import { GF_STATUS_TO_ORDER_STATUS } from '@/constants/goodsflow';

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

export interface GfCenter {
  centerCode: string;
  centerName: string;
  fromName: string;
  fromPhoneNo: string;
  fromAddress1: string;
  fromAddress2: string;
  fromZipcode: string;
}

export interface GfContractRate {
  boxSize: string;
  boxSizeName: string;
  creditCost: number;
  collectCost: number;
  returnCost: number;
}

export interface GfContract {
  centerCode: string;
  contractId: string;
  status: string;
  transporter: string;
  contractCode: string;
  contractRates: GfContractRate[];
}

export interface GfDeliveryItem {
  orderNo:   string;
  orderDate: string;
  name:      string;
  quantity:  number;
  price:     number;
  code?:     string;
  option?:   string;
}

export interface GfShippingPrintItem {
  orderId:          string;
  orderNumber:      string;
  orderDate:        string;
  toName:           string;
  toPhoneNo:        string;
  toAddress1:       string;
  toAddress2:       string;
  toZipcode:        string;
  deliveryMessage?: string;
  consumerName?:    string;
  consumerPhoneNo?: string;
  deliveryItems:    GfDeliveryItem[];
  /** @deprecated deliveryItems 사용 — bulk 호환용 */
  itemName?:        string;
  /** @deprecated deliveryItems 사용 — bulk 호환용 */
  itemPrice?:       number;
  /** @deprecated deliveryItems 사용 — bulk 호환용 */
  itemQuantity?:    number;
}

export interface GfPrintResult {
  orderId:       string;
  orderNumber:   string;
  success:       boolean;
  gfServiceId?:  string;
  trackingNumber?: string;
  error?:        string;
}

export interface GfWebhookEvent {
  seq:            number;
  serviceId:      string;
  uniqueId:       string;
  orderNo:        string;
  transporter:    string;
  invoiceNo:      string;
  statusDateTime: string;
  deliveryStatus: string;
  location:       string;
}

// ---------------------------------------------------------------------------
// 굿스플로 사용 환경 조회 (use_test 설정 읽기)
// ---------------------------------------------------------------------------

export async function getGfEnv(): Promise<'prod' | 'test'> {
  const supabase = createClient();
  const { data } = await supabase
    .from('external_connections')
    .select('credentials')
    .eq('platform', 'goodsflow')
    .maybeSingle();
  const useTest = data?.credentials?.use_test === 'true' || data?.credentials?.use_test === true;
  return useTest ? 'test' : 'prod';
}

// ---------------------------------------------------------------------------
// 출고지 목록 조회 — DB에서 읽음
// ---------------------------------------------------------------------------

export async function getGfCenters(env: 'prod' | 'test' = 'prod'): Promise<GfCenter[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', `gf_centers_${env}`)
    .maybeSingle();
  if (!data?.value || !Array.isArray(data.value)) return [];
  return data.value as GfCenter[];
}

// ---------------------------------------------------------------------------
// 계약 목록 조회 — DB에서 읽음
// ---------------------------------------------------------------------------

export async function getGfContracts(env: 'prod' | 'test' = 'prod'): Promise<GfContract[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', `gf_contracts_${env}`)
    .maybeSingle();
  if (!data?.value || !Array.isArray(data.value)) return [];
  return data.value as GfContract[];
}

// ---------------------------------------------------------------------------
// 출고지 + 계약 동기화 — API 조회 후 DB 저장 (외부 연동 페이지 전용)
// ---------------------------------------------------------------------------

export async function syncGfData(
  env: 'prod' | 'test',
  apiKey: string,
  apiBase: string,
): Promise<{ centers: GfCenter[]; contracts: GfContract[] }> {
  const supabase = createClient();

  // 출고지 조회
  const { data: centersData, error: centersError } = await supabase.functions.invoke('gf-shipping-print', {
    body: { action: 'getCenters', overrideApiKey: apiKey, overrideApiBase: apiBase },
  });
  if (centersError) throw new Error(centersError.message);
  if (!centersData.ok) throw new Error(centersData.message ?? '출고지 조회 실패');
  const centers = centersData.centers as GfCenter[];

  // 계약 조회 (출고지가 있을 때만)
  let contracts: GfContract[] = [];
  if (centers.length > 0) {
    const codes = centers.map((c) => c.centerCode).join(',');
    const { data: contractsData, error: contractsError } = await supabase.functions.invoke('gf-shipping-print', {
      body: { action: 'getContracts', centerCodes: codes, overrideApiKey: apiKey, overrideApiBase: apiBase },
    });
    if (!contractsError && contractsData?.ok) {
      contracts = contractsData.contracts as GfContract[];
    }
  }

  // DB 저장
  await supabase.from('system_settings')
    .upsert({ key: `gf_centers_${env}`, value: centers }, { onConflict: 'key' });
  await supabase.from('system_settings')
    .upsert({ key: `gf_contracts_${env}`, value: contracts }, { onConflict: 'key' });

  return { centers, contracts };
}

// ---------------------------------------------------------------------------
// 판매자 목록 조회 — 폼 값으로 직접 API 호출 (외부 연동 페이지 전용)
// ---------------------------------------------------------------------------

export async function getGfSellers(
  apiKey: string,
  apiBase: string,
): Promise<{ sellerCode: string; sellerName: string }[]> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke('gf-shipping-print', {
    body: { action: 'getSellers', overrideApiKey: apiKey, overrideApiBase: apiBase },
  });
  if (error) throw new Error(error.message);
  if (!data.ok) throw new Error(data.message ?? '판매자 조회 실패');
  return data.sellers as { sellerCode: string; sellerName: string }[];
}

// ---------------------------------------------------------------------------
// 송장 발급 (단건/다량) — Edge Function 경유 (API Key 보호)
// ---------------------------------------------------------------------------

export async function printGfShippingLabels(
  items: GfShippingPrintItem[],
  options: { centerCode: string; transporter: string; boxSize: string },
): Promise<GfPrintResult[]> {
  const supabase = createClient();
  console.log('[GF printGfShippingLabels] Edge Function 호출:', { action: 'print', items, options });
  const { data, error } = await supabase.functions.invoke('gf-shipping-print', {
    body: { action: 'print', items, options },
  });
  console.log('[GF printGfShippingLabels] Edge Function 응답:', { data, error });
  if (error) throw new Error(error.message);
  return data.results as GfPrintResult[];
}

// ---------------------------------------------------------------------------
// 송장 출력 URI 생성
// ---------------------------------------------------------------------------

export async function getGfPrintUri(gfServiceIds: string[]): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke('gf-shipping-print', {
    body: { action: 'printUri', gfServiceIds },
  });
  if (error) throw new Error(error.message);
  if (!data.ok) throw new Error(data.message ?? '출력 URI 생성 실패');
  return data.uri as string;
}

// ---------------------------------------------------------------------------
// 송장 취소
// ---------------------------------------------------------------------------

export async function cancelGfShipping(
  gfServiceId: string,
  reasonCode: string,
  contents?: string,
): Promise<void> {
  const supabase = createClient();
  console.log('[GF cancelGfShipping] 요청:', { gfServiceId, reasonCode, contents });
  const { data, error } = await supabase.functions.invoke('gf-shipping-print', {
    body: { action: 'cancel', gfServiceId, reasonCode, ...(contents ? { contents } : {}) },
  });
  console.log('[GF cancelGfShipping] 응답:', { data, error });
  if (error) throw new Error(error.message);
  if (!data.ok) throw new Error(data.message ?? '취소 실패');
}

// ---------------------------------------------------------------------------
// Pull 동기화
// ---------------------------------------------------------------------------

export async function syncGfWebhookEvents(): Promise<void> {
  const supabase = createClient();

  const { data: setting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'gf_last_sync_at')
    .maybeSingle();

  const lastSync = setting?.value as string | null;
  if (lastSync) {
    const diffMs = Date.now() - new Date(lastSync).getTime();
    if (diffMs < 2 * 60 * 1000) return;
  }

  await supabase
    .from('system_settings')
    .update({ value: new Date().toISOString() })
    .eq('key', 'gf_last_sync_at');

  await supabase.functions.invoke('gf-shipping-print', {
    body: { action: 'pullWebhooks' },
  });
}

// ---------------------------------------------------------------------------
// Pull 이벤트 DB 반영
// ---------------------------------------------------------------------------

export async function applyGfDeliveryStatus(
  gfServiceId: string,
  deliveryStatus: string,
  rawPayload: Record<string, unknown>,
): Promise<void> {
  const supabase = createClient();

  const { data: shipment } = await supabase
    .from('shipments')
    .select('order_id')
    .eq('gf_service_id', gfServiceId)
    .maybeSingle();

  if (!shipment?.order_id) return;

  await supabase.from('gf_delivery_logs').insert({
    order_id:       shipment.order_id,
    gf_service_id:  gfServiceId,
    delivery_status: deliveryStatus,
    raw_payload:    rawPayload,
  });

  const toStatus = GF_STATUS_TO_ORDER_STATUS[deliveryStatus];
  if (toStatus) {
    const { transitionOrderStatus } = await import('@/services/orders');
    await transitionOrderStatus(shipment.order_id, toStatus as any, {
      note: `굿스플로 배송 상태: ${deliveryStatus}`,
    });
  }
}
