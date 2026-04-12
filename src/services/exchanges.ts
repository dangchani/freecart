import { createClient } from '@/lib/supabase/client';

export type ExchangeStatus = 'pending' | 'approved' | 'rejected' | 'collected' | 'reshipped' | 'completed';

export interface ExchangeRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  userId: string;
  itemIds: string[];
  reason: string;
  exchangeVariantId: string | null;
  status: ExchangeStatus;
  adminMemo: string | null;
  trackingNumber: string | null;
  trackingCompanyId: string | null;
  reshipTrackingNumber: string | null;
  reshipCompanyId: string | null;
  approvedAt: string | null;
  collectedAt: string | null;
  reshippedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export const EXCHANGE_STATUS_LABELS: Record<ExchangeStatus, string> = {
  pending:   '검토중',
  approved:  '승인됨',
  rejected:  '거부됨',
  collected: '수거완료',
  reshipped: '재발송',
  completed: '완료',
};

// 교환 요청 목록 조회 (관리자)
export async function getAllExchangeRequests(filters?: {
  status?: ExchangeStatus;
  dateFrom?: string;
  dateTo?: string;
}): Promise<ExchangeRequest[]> {
  const supabase = createClient();

  let query = supabase
    .from('exchanges')
    .select(`
      id, user_id, item_ids, reason, exchange_variant_id, status, admin_memo,
      tracking_number, tracking_company_id,
      reship_tracking_number, reship_company_id,
      approved_at, collected_at, reshipped_at, completed_at, created_at,
      order:orders(id, order_number, orderer_name)
    `)
    .order('created_at', { ascending: false });

  if (filters?.status)   query = query.eq('status', filters.status);
  if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters?.dateTo)   query = query.lte('created_at', filters.dateTo + 'T23:59:59');

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((e: any) => ({
    id:                   e.id,
    orderId:              e.order?.id ?? '',
    orderNumber:          e.order?.order_number ?? '',
    customerName:         e.order?.orderer_name ?? '',
    userId:               e.user_id,
    itemIds:              e.item_ids ?? [],
    reason:               e.reason,
    exchangeVariantId:    e.exchange_variant_id,
    status:               e.status,
    adminMemo:            e.admin_memo,
    trackingNumber:       e.tracking_number,
    trackingCompanyId:    e.tracking_company_id,
    reshipTrackingNumber: e.reship_tracking_number,
    reshipCompanyId:      e.reship_company_id,
    approvedAt:           e.approved_at,
    collectedAt:          e.collected_at,
    reshippedAt:          e.reshipped_at,
    completedAt:          e.completed_at,
    createdAt:            e.created_at,
  }));
}

// 교환 승인
export async function approveExchange(
  exchangeId: string,
  adminMemo?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('exchanges')
    .update({
      status:      'approved',
      approved_at: new Date().toISOString(),
      ...(adminMemo ? { admin_memo: adminMemo } : {}),
    })
    .eq('id', exchangeId);

  if (error) return { success: false, error: '승인 처리에 실패했습니다.' };
  return { success: true };
}

// 교환 거부
export async function rejectExchange(
  exchangeId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('exchanges')
    .update({
      status:     'rejected',
      admin_memo: reason,
    })
    .eq('id', exchangeId);

  if (error) return { success: false, error: '거부 처리에 실패했습니다.' };
  return { success: true };
}

// 수거 운송장 등록 → 상태: collected
export async function updateExchangeCollectTracking(
  exchangeId: string,
  trackingNumber: string,
  companyId?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('exchanges')
    .update({
      tracking_number:     trackingNumber,
      tracking_company_id: companyId ?? null,
      status:              'collected',
      collected_at:        new Date().toISOString(),
    })
    .eq('id', exchangeId);

  if (error) return { success: false, error: '수거 운송장 등록에 실패했습니다.' };
  return { success: true };
}

// 재발송 운송장 등록 → 상태: reshipped
export async function updateExchangeReshipTracking(
  exchangeId: string,
  trackingNumber: string,
  companyId?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('exchanges')
    .update({
      reship_tracking_number: trackingNumber,
      reship_company_id:      companyId ?? null,
      status:                 'reshipped',
      reshipped_at:           new Date().toISOString(),
    })
    .eq('id', exchangeId);

  if (error) return { success: false, error: '재발송 운송장 등록에 실패했습니다.' };
  return { success: true };
}

// 교환 완료 처리 — 원 상품 재고 복구 + 교환 상품 재고 차감
export async function completeExchange(
  exchangeId: string,
  adminMemo?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  try {
    const { data: exc, error: fetchErr } = await supabase
      .from('exchanges')
      .select('order_id, item_ids, exchange_variant_id, status')
      .eq('id', exchangeId)
      .single();

    if (fetchErr || !exc) return { success: false, error: '교환 정보를 찾을 수 없습니다.' };
    if (exc.status !== 'reshipped') return { success: false, error: '재발송 완료 상태에서만 처리할 수 있습니다.' };

    // 원 상품 주문 아이템 조회
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id, product_id, variant_id, quantity')
      .eq('order_id', exc.order_id)
      .in('id', exc.item_ids ?? []);

    const totalQty = (orderItems ?? []).reduce((sum: number, i: any) => sum + i.quantity, 0);

    // 원 상품 재고 복구
    for (const item of orderItems ?? []) {
      if (item.variant_id) {
        await supabase.rpc('increment_variant_stock', {
          p_variant_id: item.variant_id,
          p_quantity:   item.quantity,
        });
      } else {
        await supabase.rpc('increment_product_stock', {
          p_product_id: item.product_id,
          p_quantity:   item.quantity,
        });
      }
    }

    // 교환 상품 재고 차감 (exchange_variant_id 지정된 경우)
    if (exc.exchange_variant_id && totalQty > 0) {
      await supabase.rpc('decrement_variant_stock', {
        p_variant_id: exc.exchange_variant_id,
        p_quantity:   totalQty,
      });
    }

    // 교환 상태 업데이트
    const { error: updateErr } = await supabase
      .from('exchanges')
      .update({
        status:       'completed',
        completed_at: new Date().toISOString(),
        ...(adminMemo ? { admin_memo: adminMemo } : {}),
      })
      .eq('id', exchangeId);

    if (updateErr) return { success: false, error: '완료 처리에 실패했습니다.' };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message ?? '교환 완료 처리 중 오류가 발생했습니다.' };
  }
}
