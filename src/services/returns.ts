import { createClient } from '@/lib/supabase/client';
import { transitionOrderStatus } from '@/services/orders';
import type { OrderStatus } from '@/constants/orderStatus';

export type ReturnStatus = 'pending' | 'approved' | 'rejected' | 'collected' | 'completed';

export interface ReturnRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  userId: string;
  itemIds: string[];
  reason: string;
  description: string | null;
  status: ReturnStatus;
  adminMemo: string | null;
  trackingNumber: string | null;
  trackingCompanyId: string | null;
  approvedAt: string | null;
  collectedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  pending:   '검토중',
  approved:  '승인됨',
  rejected:  '거부됨',
  collected: '수거완료',
  completed: '완료',
};

// 반품 요청 목록 조회 (관리자)
export async function getAllReturnRequests(filters?: {
  status?: ReturnStatus;
  dateFrom?: string;
  dateTo?: string;
}): Promise<ReturnRequest[]> {
  const supabase = createClient();

  let query = supabase
    .from('returns')
    .select(`
      id, user_id, item_ids, reason, description, status, admin_memo,
      tracking_number, tracking_company_id,
      approved_at, collected_at, completed_at, created_at,
      order:orders(id, order_number, orderer_name)
    `)
    .order('created_at', { ascending: false });

  if (filters?.status)   query = query.eq('status', filters.status);
  if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters?.dateTo)   query = query.lte('created_at', filters.dateTo + 'T23:59:59');

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((r: any) => ({
    id:                r.id,
    orderId:           r.order?.id ?? '',
    orderNumber:       r.order?.order_number ?? '',
    customerName:      r.order?.orderer_name ?? '',
    userId:            r.user_id,
    itemIds:           r.item_ids ?? [],
    reason:            r.reason,
    description:       r.description,
    status:            r.status,
    adminMemo:         r.admin_memo,
    trackingNumber:    r.tracking_number,
    trackingCompanyId: r.tracking_company_id,
    approvedAt:        r.approved_at,
    collectedAt:       r.collected_at,
    completedAt:       r.completed_at,
    createdAt:         r.created_at,
  }));
}

// 반품 승인
export async function approveReturn(
  returnId: string,
  adminMemo?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('returns')
    .update({
      status:      'approved',
      approved_at: new Date().toISOString(),
      ...(adminMemo ? { admin_memo: adminMemo } : {}),
    })
    .eq('id', returnId);

  if (error) return { success: false, error: '승인 처리에 실패했습니다.' };
  return { success: true };
}

// 반품 거부
export async function rejectReturn(
  returnId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('returns')
    .update({
      status:     'rejected',
      admin_memo: reason,
    })
    .eq('id', returnId);

  if (error) return { success: false, error: '거부 처리에 실패했습니다.' };
  return { success: true };
}

// 수거 운송장 등록 → 상태: collected
export async function updateReturnCollectTracking(
  returnId: string,
  trackingNumber: string,
  companyId?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('returns')
    .update({
      tracking_number:     trackingNumber,
      tracking_company_id: companyId ?? null,
      status:              'collected',
      collected_at:        new Date().toISOString(),
    })
    .eq('id', returnId);

  if (error) return { success: false, error: '수거 운송장 등록에 실패했습니다.' };
  return { success: true };
}

// 반품 완료 처리 — 재고 복구 + 주문 상태 → returned
export async function completeReturn(
  returnId: string,
  adminMemo?: string,
  changedBy?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  try {
    const { data: ret, error: fetchErr } = await supabase
      .from('returns')
      .select('order_id, item_ids, status')
      .eq('id', returnId)
      .single();

    if (fetchErr || !ret) return { success: false, error: '반품 정보를 찾을 수 없습니다.' };
    if (ret.status !== 'collected') return { success: false, error: '수거 완료 상태에서만 처리할 수 있습니다.' };

    // 반품 대상 주문 아이템 조회
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id, product_id, variant_id, quantity')
      .eq('order_id', ret.order_id)
      .in('id', ret.item_ids ?? []);

    // 재고 복구
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

    // 주문 상태 전이: return_requested → returned
    await transitionOrderStatus(ret.order_id, 'returned' as OrderStatus, {
      note:      `반품 완료 처리 (return #${returnId})`,
      changedBy,
    });

    // 반품 상태 업데이트
    const { error: updateErr } = await supabase
      .from('returns')
      .update({
        status:       'completed',
        completed_at: new Date().toISOString(),
        ...(adminMemo ? { admin_memo: adminMemo } : {}),
      })
      .eq('id', returnId);

    if (updateErr) return { success: false, error: '완료 처리에 실패했습니다.' };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message ?? '반품 완료 처리 중 오류가 발생했습니다.' };
  }
}
