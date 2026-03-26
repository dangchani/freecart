import { createClient } from '@/lib/supabase/client';

export interface ShippingCompany {
  id: string;
  code: string;
  name: string;
  trackingUrl: string;
  isActive: boolean;
}

export interface TrackingInfo {
  carrierId: string;
  carrierName: string;
  trackingNumber: string;
  status: TrackingStatus;
  statusText: string;
  estimatedDelivery?: string;
  events: TrackingEvent[];
}

export interface TrackingEvent {
  time: string;
  location: string;
  status: string;
  description: string;
}

export type TrackingStatus =
  | 'unknown'
  | 'information_received'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception';

// 배송사 목록
export const SHIPPING_COMPANIES: Record<string, { name: string; trackingUrl: string }> = {
  cjlogistics: {
    name: 'CJ대한통운',
    trackingUrl: 'https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=',
  },
  hanjin: {
    name: '한진택배',
    trackingUrl: 'https://www.hanjin.co.kr/kor/CMS/DeliveryMgr/WaybillResult.do?mession=open&wblnum=',
  },
  lotte: {
    name: '롯데택배',
    trackingUrl: 'https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=',
  },
  logen: {
    name: '로젠택배',
    trackingUrl: 'https://www.ilogen.com/web/personal/trace/',
  },
  epost: {
    name: '우체국택배',
    trackingUrl: 'https://service.epost.go.kr/trace.RetrieveDomRi498.postal?sid1=',
  },
  cvsnet: {
    name: 'GS편의점택배',
    trackingUrl: 'https://www.cvsnet.co.kr/invoice/tracking.do?invoice_no=',
  },
  cupost: {
    name: 'CU편의점택배',
    trackingUrl: 'https://www.cupost.co.kr/postbox/delivery/localResult.cupost?invoice_no=',
  },
  daesin: {
    name: '대신택배',
    trackingUrl: 'https://www.ds3211.co.kr/freight/internalFreightSearch.ht?billno=',
  },
  kdexp: {
    name: '경동택배',
    trackingUrl: 'https://kdexp.com/newDeliverySearch.kd?barcode=',
  },
  ilyang: {
    name: '일양로지스',
    trackingUrl: 'https://www.ilyanglogis.com/functionality/tracking_result.asp?hawb_no=',
  },
};

// 배송사 목록 가져오기
export async function getShippingCompanies(): Promise<ShippingCompany[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('shipping_companies')
    .select('id, code, name, tracking_url, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error || !data) {
    // DB에 없으면 기본 목록 반환
    return Object.entries(SHIPPING_COMPANIES).map(([code, info]) => ({
      id: code,
      code,
      name: info.name,
      trackingUrl: info.trackingUrl,
      isActive: true,
    }));
  }

  return data.map((c: any) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    trackingUrl: c.tracking_url,
    isActive: c.is_active,
  }));
}

// 배송 추적 URL 생성
export function getTrackingUrl(carrierCode: string, trackingNumber: string): string {
  const company = SHIPPING_COMPANIES[carrierCode];
  if (!company) return '';
  return `${company.trackingUrl}${trackingNumber}`;
}

// 배송 조회 (Tracker API 또는 스마트택배 API 연동)
export async function getTrackingInfo(
  carrierCode: string,
  trackingNumber: string
): Promise<TrackingInfo | null> {
  const supabase = createClient();

  // Edge Function 호출 (실제 배송 추적 API 연동)
  const { data, error } = await supabase.functions.invoke('track-shipment', {
    body: {
      carrier_code: carrierCode,
      tracking_number: trackingNumber,
    },
  });

  if (error) {
    console.error('Failed to track shipment:', error);
    // 오류 시 기본 정보만 반환
    return {
      carrierId: carrierCode,
      carrierName: SHIPPING_COMPANIES[carrierCode]?.name || carrierCode,
      trackingNumber,
      status: 'unknown',
      statusText: '배송 조회 중 오류가 발생했습니다.',
      events: [],
    };
  }

  return data as TrackingInfo;
}

// 주문의 배송 정보 조회
export async function getOrderShipping(orderId: string): Promise<{
  shipment?: {
    id: string;
    carrierCode: string;
    carrierName: string;
    trackingNumber: string;
    status: string;
    shippedAt?: string;
    deliveredAt?: string;
  };
  tracking?: TrackingInfo;
} | null> {
  const supabase = createClient();

  // 배송 정보 가져오기
  const { data: shipment, error } = await supabase
    .from('shipments')
    .select(`
      id, tracking_number, status, shipped_at, delivered_at,
      shipping_companies(code, name)
    `)
    .eq('order_id', orderId)
    .single();

  if (error || !shipment) return null;

  const carrierCode = (shipment as any).shipping_companies?.code || '';
  const carrierName = (shipment as any).shipping_companies?.name || '';
  const trackingNumber = shipment.tracking_number || '';

  const result: any = {
    shipment: {
      id: shipment.id,
      carrierCode,
      carrierName,
      trackingNumber,
      status: shipment.status,
      shippedAt: shipment.shipped_at,
      deliveredAt: shipment.delivered_at,
    },
  };

  // 운송장 번호가 있으면 실시간 추적
  if (trackingNumber && carrierCode) {
    result.tracking = await getTrackingInfo(carrierCode, trackingNumber);
  }

  return result;
}

// 배송 상태 업데이트 (웹훅 또는 스케줄러에서 호출)
export async function updateShipmentStatus(
  shipmentId: string,
  status: string,
  deliveredAt?: string
): Promise<boolean> {
  const supabase = createClient();

  const updates: any = { status };
  if (deliveredAt) {
    updates.delivered_at = deliveredAt;
  }

  const { error } = await supabase
    .from('shipments')
    .update(updates)
    .eq('id', shipmentId);

  if (error) return false;

  // 배송 완료 시 주문 상태도 업데이트
  if (status === 'delivered') {
    const { data: shipment } = await supabase
      .from('shipments')
      .select('order_id')
      .eq('id', shipmentId)
      .single();

    if (shipment) {
      await supabase
        .from('orders')
        .update({ status: 'delivered' })
        .eq('id', shipment.order_id);
    }
  }

  return true;
}

// 배송 조회 결과 캐싱 (동일 조회 방지)
const trackingCache = new Map<string, { data: TrackingInfo; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5분

export async function getTrackingInfoCached(
  carrierCode: string,
  trackingNumber: string
): Promise<TrackingInfo | null> {
  const cacheKey = `${carrierCode}:${trackingNumber}`;
  const cached = trackingCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const result = await getTrackingInfo(carrierCode, trackingNumber);

  if (result) {
    trackingCache.set(cacheKey, { data: result, timestamp: Date.now() });
  }

  return result;
}

// 배송 상태 텍스트 변환
export function getStatusText(status: TrackingStatus): string {
  const statusMap: Record<TrackingStatus, string> = {
    unknown: '조회 불가',
    information_received: '접수',
    in_transit: '배송중',
    out_for_delivery: '배송 출발',
    delivered: '배송 완료',
    exception: '배송 이상',
  };
  return statusMap[status] || status;
}

// 예상 배송일 계산
export function estimateDeliveryDate(shippedAt: string, carrierCode: string): Date {
  const shipped = new Date(shippedAt);
  let days = 2; // 기본 2일

  // 배송사별 예상 일수 조정
  if (['cvsnet', 'cupost'].includes(carrierCode)) {
    days = 3; // 편의점 택배는 3일
  } else if (carrierCode === 'epost') {
    days = 3; // 우체국 택배 3일
  }

  const estimated = new Date(shipped);
  estimated.setDate(estimated.getDate() + days);

  // 주말 제외
  while (estimated.getDay() === 0 || estimated.getDay() === 6) {
    estimated.setDate(estimated.getDate() + 1);
  }

  return estimated;
}

// 배송 알림 설정
export async function setShippingNotification(
  orderId: string,
  options: {
    notifyOnShipped?: boolean;
    notifyOnDelivered?: boolean;
    notifyOnException?: boolean;
    email?: string;
    phone?: string;
  }
): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('shipping_notifications')
    .upsert({
      order_id: orderId,
      notify_on_shipped: options.notifyOnShipped ?? true,
      notify_on_delivered: options.notifyOnDelivered ?? true,
      notify_on_exception: options.notifyOnException ?? true,
      email: options.email,
      phone: options.phone,
    });

  return !error;
}
