import { createClient } from '@/lib/supabase/client';
import { transitionOrderStatus } from '@/services/orders';
import { ORDER_RETURNABLE_STATUSES } from '@/constants/orderStatus';
import type { OrderStatus } from '@/constants/orderStatus';

export type ReturnStatus = 'pending' | 'approved' | 'rejected' | 'collected' | 'completed';

export interface ReturnItem {
  order_item_id: string;
  quantity:      number;
}

export interface ReturnRequest {
  id:                string;
  orderId:           string;
  orderNumber:       string;
  customerName:      string;
  userId:            string;
  items:             ReturnItem[];
  reason:            string;
  description:       string | null;
  status:            ReturnStatus;
  refundAmount:      number;
  refundMethod:      string | null;
  bankName:          string | null;
  bankAccount:       string | null;
  accountHolder:     string | null;
  initiatedBy:       'customer' | 'admin';
  adminMemo:         string | null;
  trackingNumber:    string | null;
  trackingCompanyId: string | null;
  approvedAt:        string | null;
  collectedAt:       string | null;
  processedAt:       string | null;
  completedAt:       string | null;
  createdAt:         string;
}

export interface ReturnableItem {
  id:             string;
  productName:    string;
  optionText:     string | null;
  unitPrice:      number;
  quantity:       number;
  returnedQty:    number;
  exchangedQty:   number;
  availableQty:   number;
  discountAmount: number;
  variantId:      string | null;
  productId:      string;
}

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  pending:   '검토중',
  approved:  '승인됨',
  rejected:  '거부됨',
  collected: '수거완료',
  completed: '완료',
};

export const RETURN_REASONS: { value: string; label: string }[] = [
  { value: 'change_of_mind',   label: '단순 변심' },
  { value: 'defective',        label: '상품 불량' },
  { value: 'wrong_product',    label: '오배송' },
  { value: 'not_as_described', label: '상품 정보 상이' },
  { value: 'late_delivery',    label: '배송 지연' },
  { value: 'other',            label: '기타' },
];

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
      id, user_id, items, reason, description, status, admin_memo,
      refund_amount, refund_method, bank_name, bank_account, account_holder,
      initiated_by, tracking_number, tracking_company_id,
      approved_at, collected_at, processed_at, completed_at, created_at,
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
    items:             r.items ?? [],
    reason:            r.reason,
    description:       r.description,
    status:            r.status,
    refundAmount:      r.refund_amount ?? 0,
    refundMethod:      r.refund_method ?? null,
    bankName:          r.bank_name ?? null,
    bankAccount:       r.bank_account ?? null,
    accountHolder:     r.account_holder ?? null,
    initiatedBy:       r.initiated_by ?? 'customer',
    adminMemo:         r.admin_memo,
    trackingNumber:    r.tracking_number,
    trackingCompanyId: r.tracking_company_id,
    approvedAt:        r.approved_at,
    collectedAt:       r.collected_at,
    processedAt:       r.processed_at ?? null,
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
      .select('order_id, items, status, refund_amount')
      .eq('id', returnId)
      .single();

    if (fetchErr || !ret) return { success: false, error: '반품 정보를 찾을 수 없습니다.' };
    if (ret.status !== 'collected') return { success: false, error: '수거 완료 상태에서만 처리할 수 있습니다.' };

    const returnItems: ReturnItem[] = ret.items ?? [];
    const itemIds = returnItems.map((i) => i.order_item_id);

    // 반품 대상 주문 아이템 조회
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id, product_id, variant_id, quantity, returned_quantity')
      .eq('order_id', ret.order_id)
      .in('id', itemIds);

    // 재고 복구 (반품 수량 기준) + order_items 업데이트
    for (const retItem of returnItems) {
      const orderItem = (orderItems ?? []).find((o: any) => o.id === retItem.order_item_id);
      if (!orderItem) continue;

      if (orderItem.variant_id) {
        await supabase.rpc('increment_variant_stock', {
          p_variant_id: orderItem.variant_id,
          p_quantity:   retItem.quantity,
        });
      } else {
        await supabase.rpc('increment_product_stock', {
          p_product_id: orderItem.product_id,
          p_quantity:   retItem.quantity,
        });
      }

      const newReturnedQty = ((orderItem as any).returned_quantity ?? 0) + retItem.quantity;
      const itemUpdate: Record<string, unknown> = { returned_quantity: newReturnedQty };
      if (newReturnedQty >= orderItem.quantity) {
        itemUpdate.status = 'returned';
      }
      await supabase
        .from('order_items')
        .update(itemUpdate)
        .eq('id', orderItem.id);
    }

    // orders.returned_amount 업데이트
    const { data: orderRow } = await supabase
      .from('orders')
      .select('returned_amount')
      .eq('id', ret.order_id)
      .single();

    const prevReturnedAmount = (orderRow as any)?.returned_amount ?? 0;
    await supabase
      .from('orders')
      .update({ returned_amount: prevReturnedAmount + ((ret as any).refund_amount ?? 0) })
      .eq('id', ret.order_id);

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

// 반품 가능 아이템 목록 조회
export async function getReturnableItems(orderId: string): Promise<ReturnableItem[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('order_items')
    .select('id, product_id, variant_id, product_name, option_text, unit_price, quantity, returned_quantity, exchanged_quantity, discount_amount, item_type')
    .eq('order_id', orderId)
    .neq('item_type', 'gift');

  if (error || !data) return [];

  return (data as any[])
    .map((item) => {
      const returnedQty  = item.returned_quantity  ?? 0;
      const exchangedQty = item.exchanged_quantity ?? 0;
      const availableQty = item.quantity - returnedQty - exchangedQty;
      return {
        id:             item.id,
        productName:    item.product_name,
        optionText:     item.option_text ?? null,
        unitPrice:      item.unit_price ?? 0,
        quantity:       item.quantity,
        returnedQty,
        exchangedQty,
        availableQty,
        discountAmount: item.discount_amount ?? 0,
        variantId:      item.variant_id ?? null,
        productId:      item.product_id,
      };
    })
    .filter((item) => item.availableQty > 0);
}

// 반품 환불 금액 계산 (순수 함수)
export function calculateReturnRefundAmount(
  returnItems: ReturnItem[],
  orderItems: ReturnableItem[],
): number {
  let total = 0;
  for (const retItem of returnItems) {
    const orderItem = orderItems.find((o) => o.id === retItem.order_item_id);
    if (!orderItem) continue;
    const proportionalDiscount = Math.floor(
      (orderItem.discountAmount * retItem.quantity) / orderItem.quantity,
    );
    total += orderItem.unitPrice * retItem.quantity - proportionalDiscount;
  }
  return total;
}

// 관리자 반품 즉시 처리 (completed 상태로 직접 생성)
export async function createAdminReturn(params: {
  orderId:        string;
  adminId:        string;
  items:          ReturnItem[];
  reason:         string;
  description?:   string;
  refundMethod?:  string;
  bankName?:      string;
  bankAccount?:   string;
  accountHolder?: string;
  adminMemo?:     string;
}): Promise<{ success: boolean; error?: string; returnId?: string; refundAmount?: number }> {
  const supabase = createClient();

  try {
    // 1. 주문 + 아이템 조회
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, status, user_id, payment_method, returned_amount')
      .eq('id', params.orderId)
      .single();

    if (orderErr || !order) return { success: false, error: '주문을 찾을 수 없습니다.' };

    const { data: rawItems, error: itemsErr } = await supabase
      .from('order_items')
      .select('id, product_id, variant_id, product_name, option_text, unit_price, quantity, returned_quantity, exchanged_quantity, discount_amount, item_type, status')
      .eq('order_id', params.orderId);

    if (itemsErr || !rawItems) return { success: false, error: '주문 아이템을 조회할 수 없습니다.' };

    // 2. 유효성 검사
    if (!ORDER_RETURNABLE_STATUSES.includes((order as any).status as OrderStatus)) {
      return { success: false, error: '현재 주문 상태에서는 반품 처리가 불가능합니다.' };
    }

    for (const retItem of params.items) {
      const orderItem = (rawItems as any[]).find((o) => o.id === retItem.order_item_id);
      if (!orderItem) return { success: false, error: `주문 아이템을 찾을 수 없습니다: ${retItem.order_item_id}` };
      if (orderItem.item_type === 'gift') return { success: false, error: '사은품은 반품 처리할 수 없습니다.' };

      const returnedQty  = orderItem.returned_quantity  ?? 0;
      const exchangedQty = orderItem.exchanged_quantity ?? 0;
      const availableQty = orderItem.quantity - returnedQty - exchangedQty;
      if (retItem.quantity > availableQty) {
        return { success: false, error: `반품 가능 수량을 초과했습니다: ${orderItem.product_name}` };
      }
    }

    // 3. 환불 금액 계산
    const returnableItems: ReturnableItem[] = (rawItems as any[]).map((item) => ({
      id:             item.id,
      productName:    item.product_name,
      optionText:     item.option_text ?? null,
      unitPrice:      item.unit_price ?? 0,
      quantity:       item.quantity,
      returnedQty:    item.returned_quantity  ?? 0,
      exchangedQty:   item.exchanged_quantity ?? 0,
      availableQty:   item.quantity - (item.returned_quantity ?? 0) - (item.exchanged_quantity ?? 0),
      discountAmount: item.discount_amount ?? 0,
      variantId:      item.variant_id ?? null,
      productId:      item.product_id,
    }));

    const refundAmount = calculateReturnRefundAmount(params.items, returnableItems);

    // 4. 환불 방법 결정
    let refundMethod = params.refundMethod;
    if (!refundMethod) {
      const pm = (order as any).payment_method as string;
      if (pm === 'card')                                            refundMethod = 'card';
      else if (pm === 'bank_transfer' || pm === 'virtual_account') refundMethod = 'bank_transfer';
      else if (pm === 'point')                                      refundMethod = 'point';
      else if (pm === 'deposit')                                    refundMethod = 'deposit';
      else                                                          refundMethod = 'bank_transfer';
    }

    // 5. returns 레코드 삽입
    const now = new Date().toISOString();
    const { data: inserted, error: insertErr } = await supabase
      .from('returns')
      .insert({
        order_id:       params.orderId,
        user_id:        (order as any).user_id,
        items:          params.items,
        reason:         params.reason,
        description:    params.description    ?? null,
        status:         'completed',
        refund_amount:  refundAmount,
        refund_method:  refundMethod,
        bank_name:      params.bankName       ?? null,
        bank_account:   params.bankAccount    ?? null,
        account_holder: params.accountHolder  ?? null,
        initiated_by:   'admin',
        processed_at:   now,
        completed_at:   now,
        admin_memo:     params.adminMemo      ?? null,
      })
      .select('id')
      .single();

    if (insertErr || !inserted) return { success: false, error: '반품 처리에 실패했습니다.' };
    const returnId = (inserted as any).id as string;

    // 6. 재고 복구 + 7. order_items 업데이트
    for (const retItem of params.items) {
      const orderItem = (rawItems as any[]).find((o) => o.id === retItem.order_item_id);
      if (!orderItem || orderItem.item_type === 'gift') continue;

      if (orderItem.variant_id) {
        await supabase.rpc('increment_variant_stock', {
          p_variant_id: orderItem.variant_id,
          p_quantity:   retItem.quantity,
        });
      } else {
        await supabase.rpc('increment_product_stock', {
          p_product_id: orderItem.product_id,
          p_quantity:   retItem.quantity,
        });
      }

      const newReturnedQty = (orderItem.returned_quantity ?? 0) + retItem.quantity;
      const itemUpdate: Record<string, unknown> = { returned_quantity: newReturnedQty };
      if (newReturnedQty >= orderItem.quantity) {
        itemUpdate.status = 'returned';
      }
      await supabase
        .from('order_items')
        .update(itemUpdate)
        .eq('id', orderItem.id);
    }

    // 8. orders.returned_amount 업데이트
    const prevReturnedAmount = (order as any).returned_amount ?? 0;
    await supabase
      .from('orders')
      .update({ returned_amount: prevReturnedAmount + refundAmount })
      .eq('id', params.orderId);

    // 9. 주문 상태 이력 기록
    await supabase.from('order_status_history').insert({
      order_id:    params.orderId,
      from_status: (order as any).status,
      to_status:   (order as any).status,
      changed_by:  params.adminId,
      note:        `관리자 반품 처리 (return #${returnId}), 환불금액: ${refundAmount.toLocaleString()}원`,
    });

    return { success: true, returnId, refundAmount };
  } catch (err: any) {
    return { success: false, error: err.message ?? '반품 처리 중 오류가 발생했습니다.' };
  }
}
