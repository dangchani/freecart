import { createClient } from '@/lib/supabase/client';
import { transitionOrderStatus } from '@/services/orders';
import { ORDER_RETURNABLE_STATUSES } from '@/constants/orderStatus';
import type { OrderStatus } from '@/constants/orderStatus';

export type RefundType = 'refund' | 'exchange' | 'return';
export type RefundStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'pickup_requested'
  | 'collected'
  | 'processing'
  | 'completed'
  | 'cancelled';

export type RefundReason =
  | 'change_of_mind'
  | 'defective'
  | 'wrong_product'
  | 'damaged'
  | 'not_as_described'
  | 'late_delivery'
  | 'other';

export interface RefundItem {
  orderItemId: string;
  productId: string;
  productName: string;
  variantInfo?: string;
  quantity: number;
  price: number;
}

// order_item_id 형태 (returns.ts 호환)
export interface ReturnItem {
  order_item_id: string;
  quantity:      number;
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

export interface RefundRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  type: RefundType;
  reason: RefundReason;
  reasonDetail: string;
  amount: number;
  status: RefundStatus;
  items: RefundItem[];
  images?: string[];
  customerName: string;
  customerEmail: string;
  userId?: string;
  bankName?: string;
  bankAccount?: string;
  accountHolder?: string;
  trackingNumber?: string;
  adminMemo?: string;
  initiatedBy?: 'customer' | 'admin';
  refundMethod?: string;
  // 반품 픽업 관련
  returnTrackingNumber?: string;
  returnCompanyId?: string;
  gfReturnServiceId?: string;
  pickupRequestedAt?: string;
  pickupScheduledDate?: string;
  collectedAt?: string;
  createdAt: string;
  approvedAt?: string;
  completedAt?: string;
}

export const REFUND_REASONS: Record<RefundReason, string> = {
  change_of_mind: '단순 변심',
  defective: '제품 불량',
  wrong_product: '오배송',
  damaged: '배송 중 파손',
  not_as_described: '상품 정보 상이',
  late_delivery: '배송 지연',
  other: '기타',
};

export const REFUND_TYPE_LABELS: Record<RefundType, string> = {
  refund: '환불',
  exchange: '교환',
  return: '환불',
};

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  pending:          '검토중',
  approved:         '승인됨',
  rejected:         '거부됨',
  pickup_requested: '픽업요청',
  collected:        '수거완료',
  processing:       '처리중',
  completed:        '완료',
  cancelled:        '취소됨',
};

// RETURN_REASONS (returns.ts 호환 — 마이페이지 반품 신청 페이지에서 사용)
export const RETURN_REASONS: { value: string; label: string }[] = [
  { value: 'change_of_mind',   label: '단순 변심' },
  { value: 'defective',        label: '상품 불량' },
  { value: 'wrong_product',    label: '오배송' },
  { value: 'not_as_described', label: '상품 정보 상이' },
  { value: 'late_delivery',    label: '배송 지연' },
  { value: 'other',            label: '기타' },
];

// ─────────────────────────────────────────────────────────────────────────────
// 환불/교환/반품 요청 생성 (고객)
// ─────────────────────────────────────────────────────────────────────────────
export async function createRefundRequest(
  request: {
    orderId: string;
    type: RefundType;
    reason: RefundReason;
    reasonDetail: string;
    items: { orderItemId: string; quantity: number }[];
    images?: File[];
    bankName?: string;
    bankAccount?: string;
    accountHolder?: string;
  }
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  const supabase = createClient();

  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, orderer_name, orderer_email')
      .eq('id', request.orderId)
      .single();

    if (orderError || !order) {
      return { success: false, error: '주문을 찾을 수 없습니다.' };
    }

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id, product_id, product_name, variant_info, quantity, price')
      .eq('order_id', request.orderId)
      .in('id', request.items.map((i) => i.orderItemId));

    if (!orderItems || orderItems.length === 0) {
      return { success: false, error: '환불할 상품을 찾을 수 없습니다.' };
    }

    let refundAmount = 0;
    const refundItems: RefundItem[] = [];

    for (const item of request.items) {
      const orderItem = orderItems.find((oi: any) => oi.id === item.orderItemId);
      if (orderItem) {
        const itemTotal = (orderItem.price / orderItem.quantity) * item.quantity;
        refundAmount += itemTotal;
        refundItems.push({
          orderItemId: orderItem.id,
          productId: orderItem.product_id,
          productName: orderItem.product_name,
          variantInfo: orderItem.variant_info,
          quantity: item.quantity,
          price: itemTotal,
        });
      }
    }

    const imageUrls: string[] = [];
    if (request.images && request.images.length > 0) {
      for (const file of request.images) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `refunds/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('refunds')
          .upload(filePath, file);

        if (!uploadError) {
          const { data: publicUrl } = supabase.storage
            .from('refunds')
            .getPublicUrl(filePath);
          imageUrls.push(publicUrl.publicUrl);
        }
      }
    }

    const { data: refund, error: refundError } = await supabase
      .from('refunds')
      .insert({
        order_id:       request.orderId,
        type:           request.type,
        reason:         request.reason,
        reason_detail:  request.reasonDetail,
        amount:         refundAmount,
        items:          refundItems,
        images:         imageUrls,
        bank_name:      request.bankName || null,
        bank_account:   request.bankAccount || null,
        account_holder: request.accountHolder || null,
        initiated_by:   'customer',
        status:         'pending',
      })
      .select('id')
      .single();

    if (refundError) {
      return { success: false, error: '환불 요청 생성에 실패했습니다.' };
    }

    return { success: true, refundId: refund.id };
  } catch (error) {
    console.error('Failed to create refund request:', error);
    return { success: false, error: '환불 요청 중 오류가 발생했습니다.' };
  }
}

// 반품 신청 (고객) — returns 테이블 대신 refunds(type='return') 사용
export async function createReturnRequest(params: {
  orderId:       string;
  userId:        string;
  items:         ReturnItem[];
  reason:        string;
  description?:  string;
  refundMethod?: string;
  bankName?:     string;
  bankAccount?:  string;
  accountHolder?: string;
}): Promise<{ success: boolean; refundId?: string; error?: string }> {
  const supabase = createClient();

  try {
    const { data: refund, error } = await supabase
      .from('refunds')
      .insert({
        order_id:       params.orderId,
        user_id:        params.userId,
        type:           'return',
        reason:         params.reason,
        reason_detail:  params.description ?? null,
        items:          params.items,
        initiated_by:   'customer',
        status:         'pending',
        refund_method:  params.refundMethod  ?? null,
        bank_name:      params.bankName      ?? null,
        bank_account:   params.bankAccount   ?? null,
        account_holder: params.accountHolder ?? null,
      })
      .select('id')
      .single();

    if (error) return { success: false, error: '환불 신청에 실패했습니다.' };
    return { success: true, refundId: (refund as any).id };
  } catch (err: any) {
    return { success: false, error: err.message ?? '환불 신청 중 오류가 발생했습니다.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 환불 요청 목록 조회 (사용자)
// ─────────────────────────────────────────────────────────────────────────────
export async function getMyRefundRequests(userId: string): Promise<RefundRequest[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('refunds')
    .select(`
      id, type, reason, reason_detail, amount, status, items, images,
      bank_name, bank_account, account_holder, return_tracking_number,
      gf_return_service_id, pickup_requested_at, pickup_scheduled_date, collected_at,
      initiated_by, refund_method,
      created_at, approved_at, completed_at,
      orders!inner(id, order_number, orderer_name, user_id)
    `)
    .eq('orders.user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((r: any) => mapRefundRow(r));
}

// ─────────────────────────────────────────────────────────────────────────────
// 환불 요청 목록 조회 (관리자)
// ─────────────────────────────────────────────────────────────────────────────
export async function getAllRefundRequests(
  filters?: {
    status?: RefundStatus;
    type?: RefundType;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<RefundRequest[]> {
  const supabase = createClient();

  let query = supabase
    .from('refunds')
    .select(`
      id, type, reason, reason_detail, amount, status, items, images,
      bank_name, bank_account, account_holder, return_tracking_number,
      gf_return_service_id, pickup_requested_at, pickup_scheduled_date, collected_at,
      initiated_by, refund_method, user_id, admin_memo,
      created_at, approved_at, completed_at,
      orders(id, order_number, orderer_name, orderer_email)
    `)
    .order('created_at', { ascending: false });

  if (filters?.status)   query = query.eq('status', filters.status);
  if (filters?.type)     query = query.eq('type', filters.type);
  if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters?.dateTo)   query = query.lte('created_at', filters.dateTo + 'T23:59:59');

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((r: any) => mapRefundRow(r));
}

function mapRefundRow(r: any): RefundRequest {
  return {
    id:                   r.id,
    orderId:              r.orders?.id ?? r.orders?.id,
    orderNumber:          r.orders?.order_number,
    type:                 r.type,
    reason:               r.reason,
    reasonDetail:         r.reason_detail,
    amount:               r.amount,
    status:               r.status,
    items:                r.items || [],
    images:               r.images || [],
    customerName:         r.orders?.orderer_name,
    customerEmail:        r.orders?.orderer_email || '',
    userId:               r.user_id,
    bankName:             r.bank_name,
    bankAccount:          r.bank_account,
    accountHolder:        r.account_holder,
    trackingNumber:       r.tracking_number,
    adminMemo:            r.admin_memo,
    initiatedBy:          r.initiated_by ?? 'customer',
    refundMethod:         r.refund_method,
    returnTrackingNumber: r.return_tracking_number,
    returnCompanyId:      r.return_company_id,
    gfReturnServiceId:    r.gf_return_service_id,
    pickupRequestedAt:    r.pickup_requested_at,
    pickupScheduledDate:  r.pickup_scheduled_date,
    collectedAt:          r.collected_at,
    createdAt:            r.created_at,
    approvedAt:           r.approved_at,
    completedAt:          r.completed_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 환불 요청 승인
// ─────────────────────────────────────────────────────────────────────────────
export async function approveRefund(
  refundId: string,
  adminMemo?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('refunds')
    .update({
      status:      'approved',
      approved_at: new Date().toISOString(),
      ...(adminMemo ? { admin_memo: adminMemo } : {}),
    })
    .eq('id', refundId);

  if (error) return { success: false, error: '승인 처리에 실패했습니다.' };
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 환불 요청 거부
// ─────────────────────────────────────────────────────────────────────────────
export async function rejectRefund(
  refundId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('refunds')
    .update({
      status:     'rejected',
      admin_memo: reason,
    })
    .eq('id', refundId);

  if (error) return { success: false, error: '거부 처리에 실패했습니다.' };
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 환불 완료 처리 (재고/포인트/쿠폰 복구 포함, type='refund'|'exchange')
// ─────────────────────────────────────────────────────────────────────────────
export async function completeRefund(
  refundId: string,
  adminMemo?: string,
  changedBy?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { executeRefundComplete } = await import('@/services/refundOrchestrator');
  const cancelResult = await executeRefundComplete(refundId, changedBy);
  if (!cancelResult.success) {
    return { success: false, error: cancelResult.error };
  }

  const { error } = await supabase
    .from('refunds')
    .update({
      status:       'completed',
      completed_at: new Date().toISOString(),
      ...(adminMemo ? { admin_memo: adminMemo } : {}),
    })
    .eq('id', refundId);

  if (error) return { success: false, error: '완료 처리에 실패했습니다.' };
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 반품 완료 처리 (type='return') — 재고 복구 + 주문 상태 → returned
// ─────────────────────────────────────────────────────────────────────────────
export async function completeReturn(
  refundId: string,
  adminMemo?: string,
  changedBy?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  try {
    const { data: ret, error: fetchErr } = await supabase
      .from('refunds')
      .select('order_id, items, status, amount, type')
      .eq('id', refundId)
      .single();

    if (fetchErr || !ret) return { success: false, error: '환불 정보를 찾을 수 없습니다.' };
    if (ret.type !== 'return')    return { success: false, error: '상품반송 환불(return) 타입만 처리할 수 있습니다.' };
    if (ret.status !== 'collected') return { success: false, error: '수거 완료 상태에서만 처리할 수 있습니다.' };

    const returnItems: ReturnItem[] = (ret.items ?? []).map((i: any) => ({
      order_item_id: i.orderItemId ?? i.order_item_id,
      quantity:      i.quantity,
    }));
    const itemIds = returnItems.map((i) => i.order_item_id);

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id, product_id, variant_id, quantity, returned_quantity')
      .eq('order_id', ret.order_id)
      .in('id', itemIds);

    // 재고 복구 + order_items 업데이트
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
      await supabase.from('order_items').update(itemUpdate).eq('id', orderItem.id);
    }

    // orders.returned_amount 업데이트
    const { data: orderRow } = await supabase
      .from('orders')
      .select('returned_amount')
      .eq('id', ret.order_id)
      .single();

    await supabase
      .from('orders')
      .update({ returned_amount: ((orderRow as any)?.returned_amount ?? 0) + ((ret as any).amount ?? 0) })
      .eq('id', ret.order_id);

    // 전체 반품 여부 확인 → 조건부 주문 상태 전이
    const { data: allItems } = await supabase
      .from('order_items')
      .select('quantity, returned_quantity, exchanged_quantity, item_type')
      .eq('order_id', ret.order_id);

    const nonGiftItems = (allItems ?? []).filter((i: any) => i.item_type !== 'gift');
    const allFullyProcessed = nonGiftItems.length > 0 && nonGiftItems.every(
      (i: any) => ((i.returned_quantity ?? 0) + (i.exchanged_quantity ?? 0)) >= i.quantity,
    );

    if (allFullyProcessed) {
      await transitionOrderStatus(ret.order_id, 'returned' as OrderStatus, {
        note:      `환불 완료 처리 (refund #${refundId})`,
        changedBy,
      });
    }

    const { error: updateErr } = await supabase
      .from('refunds')
      .update({
        status:       'completed',
        completed_at: new Date().toISOString(),
        ...(adminMemo ? { admin_memo: adminMemo } : {}),
      })
      .eq('id', refundId);

    if (updateErr) return { success: false, error: '완료 처리에 실패했습니다.' };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message ?? '환불 완료 처리 중 오류가 발생했습니다.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 반품 수거 정보 직접 등록 (수동, GoodFlow 미사용)
// ─────────────────────────────────────────────────────────────────────────────
export async function updateReturnTracking(
  refundId: string,
  trackingNumber: string,
  companyId?: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('refunds')
    .update({
      return_tracking_number: trackingNumber,
      return_company_id:      companyId ?? null,
      status:                 'collected',
      collected_at:           new Date().toISOString(),
    })
    .eq('id', refundId);

  if (error) return { success: false, error: '운송장 정보 업데이트에 실패했습니다.' };
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 굿스플로 반품 픽업 요청
// ─────────────────────────────────────────────────────────────────────────────
export async function requestReturnPickup(params: {
  refundId:           string;
  centerCode:         string;
  transporter:        string;
  boxSize:            string;
  pickupScheduledDate?: string;  // YYYY-MM-DD
  fromName:           string;
  fromPhoneNo:        string;
  fromAddress1:       string;
  fromAddress2?:      string;
  fromZipcode:        string;
  itemName:           string;
  quantity:           number;
  orderNumber:        string;
  orderId:            string;
}): Promise<{ success: boolean; gfReturnServiceId?: string; trackingNumber?: string; error?: string }> {
  const supabase = createClient();

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gf-shipping-print`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${token}`,
          apikey:          import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action:   'requestReturn',
          refundId: params.refundId,
          item: {
            orderNumber:    params.orderNumber,
            orderId:        params.orderId,
            fromName:       params.fromName,
            fromPhoneNo:    params.fromPhoneNo,
            fromAddress1:   params.fromAddress1,
            fromAddress2:   params.fromAddress2 ?? '',
            fromZipcode:    params.fromZipcode,
            itemName:       params.itemName,
            quantity:       params.quantity,
          },
          options: {
            centerCode:         params.centerCode,
            transporter:        params.transporter,
            boxSize:            params.boxSize,
            pickupScheduledDate: params.pickupScheduledDate ?? null,
          },
        }),
      },
    );

    const body = await res.json();
    if (!body.ok) return { success: false, error: body.message ?? '픽업 요청에 실패했습니다.' };

    return {
      success:           true,
      gfReturnServiceId: body.gfReturnServiceId,
      trackingNumber:    body.trackingNumber,
    };
  } catch (err: any) {
    return { success: false, error: err.message ?? '픽업 요청 중 오류가 발생했습니다.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 환불 요청 취소 (사용자)
// ─────────────────────────────────────────────────────────────────────────────
export async function cancelRefundRequest(
  refundId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { data: refund } = await supabase
    .from('refunds')
    .select('status')
    .eq('id', refundId)
    .single();

  if (!refund) return { success: false, error: '환불 요청을 찾을 수 없습니다.' };
  if (refund.status !== 'pending') return { success: false, error: '이미 처리된 요청은 취소할 수 없습니다.' };

  const { error } = await supabase
    .from('refunds')
    .update({ status: 'cancelled' })
    .eq('id', refundId);

  if (error) return { success: false, error: '취소 처리에 실패했습니다.' };
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// 환불 가능 여부 확인
// ─────────────────────────────────────────────────────────────────────────────
export async function canRequestRefund(orderId: string): Promise<{
  canRefund: boolean;
  reason?: string;
  refundableItems?: { orderItemId: string; maxQuantity: number }[];
}> {
  const supabase = createClient();

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, status, created_at')
    .eq('id', orderId)
    .single();

  if (error || !order) return { canRefund: false, reason: '주문을 찾을 수 없습니다.' };

  const refundableStatuses = ['paid', 'processing', 'shipped', 'delivered'];
  if (!refundableStatuses.includes(order.status)) {
    return { canRefund: false, reason: '환불 가능한 주문 상태가 아닙니다.' };
  }

  if (order.status === 'delivered') {
    const { data: shipment } = await supabase
      .from('shipments')
      .select('delivered_at')
      .eq('order_id', orderId)
      .maybeSingle();

    const baseDate = shipment?.delivered_at
      ? new Date(shipment.delivered_at)
      : new Date(order.created_at);

    const daysSince = Math.floor((Date.now() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince > 7) {
      return { canRefund: false, reason: '배송 완료 후 7일이 지나 환불이 불가능합니다.' };
    }
  }

  const { data: existingRefunds } = await supabase
    .from('refunds')
    .select('items, status')
    .eq('order_id', orderId)
    .in('status', ['pending', 'approved', 'pickup_requested', 'collected', 'processing']);

  const { data: orderItems } = await supabase
    .from('order_items')
    .select('id, quantity')
    .eq('order_id', orderId);

  const refundedQuantities: Record<string, number> = {};
  (existingRefunds || []).forEach((r: any) => {
    (r.items || []).forEach((item: any) => {
      const itemId = item.orderItemId ?? item.order_item_id;
      refundedQuantities[itemId] = (refundedQuantities[itemId] || 0) + item.quantity;
    });
  });

  const refundableItems = (orderItems || [])
    .map((item: any) => ({
      orderItemId: item.id,
      maxQuantity: item.quantity - (refundedQuantities[item.id] || 0),
    }))
    .filter((item) => item.maxQuantity > 0);

  if (refundableItems.length === 0) {
    return { canRefund: false, reason: '환불 가능한 상품이 없습니다.' };
  }

  return { canRefund: true, refundableItems };
}

// ─────────────────────────────────────────────────────────────────────────────
// 반품 가능 아이템 목록 조회 (returns.ts 에서 이전)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// 반품 환불 금액 계산 (순수 함수, returns.ts 에서 이전)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// 관리자 반품 즉시 처리 (returns.ts 에서 이전 — refunds 테이블 사용)
// ─────────────────────────────────────────────────────────────────────────────
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

    let refundMethod = params.refundMethod;
    if (!refundMethod) {
      const pm = (order as any).payment_method as string;
      if (pm === 'card')                                            refundMethod = 'card';
      else if (pm === 'bank_transfer' || pm === 'virtual_account') refundMethod = 'bank_transfer';
      else if (pm === 'point')                                      refundMethod = 'point';
      else if (pm === 'deposit')                                    refundMethod = 'deposit';
      else                                                          refundMethod = 'bank_transfer';
    }

    const now = new Date().toISOString();
    const { data: inserted, error: insertErr } = await supabase
      .from('refunds')
      .insert({
        order_id:       params.orderId,
        user_id:        (order as any).user_id,
        type:           'return',
        items:          params.items,
        reason:         params.reason,
        reason_detail:  params.description    ?? null,
        status:         'approved',
        amount:         refundAmount,
        refund_method:  refundMethod,
        bank_name:      params.bankName       ?? null,
        bank_account:   params.bankAccount    ?? null,
        account_holder: params.accountHolder  ?? null,
        initiated_by:   'admin',
        approved_at:    now,
        admin_memo:     params.adminMemo      ?? null,
      })
      .select('id')
      .single();

    if (insertErr || !inserted) return { success: false, error: '환불 처리에 실패했습니다.' };
    const returnId = (inserted as any).id as string;

    // 주문 이력 기록
    await supabase.from('order_status_history').insert({
      order_id:    params.orderId,
      from_status: (order as any).status,
      to_status:   (order as any).status,
      changed_by:  params.adminId,
      note:        `관리자 환불 처리 등록 (refund #${returnId}), 환불금액: ${refundAmount.toLocaleString()}원 — 상품 반송 후 완료 처리 필요`,
    });

    return { success: true, returnId, refundAmount };
  } catch (err: any) {
    return { success: false, error: err.message ?? '반품 처리 중 오류가 발생했습니다.' };
  }
}
