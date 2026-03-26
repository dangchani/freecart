import { createClient } from '@/lib/supabase/client';

export type RefundType = 'refund' | 'exchange' | 'return';
export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'cancelled';
export type RefundReason =
  | 'change_of_mind'
  | 'defective'
  | 'wrong_product'
  | 'damaged'
  | 'not_as_described'
  | 'late_delivery'
  | 'other';

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
  bankName?: string;
  bankAccount?: string;
  accountHolder?: string;
  trackingNumber?: string;
  adminMemo?: string;
  createdAt: string;
  approvedAt?: string;
  completedAt?: string;
}

export interface RefundItem {
  orderItemId: string;
  productId: string;
  productName: string;
  variantInfo?: string;
  quantity: number;
  price: number;
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
  return: '반품',
};

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  pending: '검토중',
  approved: '승인됨',
  rejected: '거부됨',
  processing: '처리중',
  completed: '완료',
  cancelled: '취소됨',
};

// 환불/교환/반품 요청 생성
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
    // 주문 정보 가져오기
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, orderer_name, orderer_email')
      .eq('id', request.orderId)
      .single();

    if (orderError || !order) {
      return { success: false, error: '주문을 찾을 수 없습니다.' };
    }

    // 주문 상품 정보 가져오기
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id, product_id, product_name, variant_info, quantity, price')
      .eq('order_id', request.orderId)
      .in('id', request.items.map((i) => i.orderItemId));

    if (!orderItems || orderItems.length === 0) {
      return { success: false, error: '환불할 상품을 찾을 수 없습니다.' };
    }

    // 환불 금액 계산
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

    // 이미지 업로드
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

    // 환불 요청 생성
    const { data: refund, error: refundError } = await supabase
      .from('refunds')
      .insert({
        order_id: request.orderId,
        type: request.type,
        reason: request.reason,
        reason_detail: request.reasonDetail,
        amount: refundAmount,
        items: refundItems,
        images: imageUrls,
        bank_name: request.bankName || null,
        bank_account: request.bankAccount || null,
        account_holder: request.accountHolder || null,
        status: 'pending',
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

// 환불 요청 목록 조회 (사용자)
export async function getMyRefundRequests(userId: string): Promise<RefundRequest[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('refunds')
    .select(`
      id, type, reason, reason_detail, amount, status, items, images,
      bank_name, bank_account, account_holder, tracking_number,
      created_at, approved_at, completed_at,
      orders(id, order_number, orderer_name, orderer_email)
    `)
    .eq('orders.user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((r: any) => ({
    id: r.id,
    orderId: r.orders.id,
    orderNumber: r.orders.order_number,
    type: r.type,
    reason: r.reason,
    reasonDetail: r.reason_detail,
    amount: r.amount,
    status: r.status,
    items: r.items || [],
    images: r.images || [],
    customerName: r.orders.orderer_name,
    customerEmail: r.orders.orderer_email,
    bankName: r.bank_name,
    bankAccount: r.bank_account,
    accountHolder: r.account_holder,
    trackingNumber: r.tracking_number,
    createdAt: r.created_at,
    approvedAt: r.approved_at,
    completedAt: r.completed_at,
  }));
}

// 환불 요청 목록 조회 (관리자)
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
      bank_name, bank_account, account_holder, tracking_number, admin_memo,
      created_at, approved_at, completed_at,
      orders(id, order_number, orderer_name, orderer_email)
    `)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.type) {
    query = query.eq('type', filters.type);
  }
  if (filters?.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte('created_at', filters.dateTo + 'T23:59:59');
  }

  const { data, error } = await query;

  if (error || !data) return [];

  return data.map((r: any) => ({
    id: r.id,
    orderId: r.orders?.id,
    orderNumber: r.orders?.order_number,
    type: r.type,
    reason: r.reason,
    reasonDetail: r.reason_detail,
    amount: r.amount,
    status: r.status,
    items: r.items || [],
    images: r.images || [],
    customerName: r.orders?.orderer_name,
    customerEmail: r.orders?.orderer_email,
    bankName: r.bank_name,
    bankAccount: r.bank_account,
    accountHolder: r.account_holder,
    trackingNumber: r.tracking_number,
    adminMemo: r.admin_memo,
    createdAt: r.created_at,
    approvedAt: r.approved_at,
    completedAt: r.completed_at,
  }));
}

// 환불 요청 승인
export async function approveRefund(
  refundId: string,
  adminMemo?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('refunds')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      admin_memo: adminMemo,
    })
    .eq('id', refundId);

  if (error) {
    return { success: false, error: '승인 처리에 실패했습니다.' };
  }

  return { success: true };
}

// 환불 요청 거부
export async function rejectRefund(
  refundId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('refunds')
    .update({
      status: 'rejected',
      admin_memo: reason,
    })
    .eq('id', refundId);

  if (error) {
    return { success: false, error: '거부 처리에 실패했습니다.' };
  }

  return { success: true };
}

// 환불 완료 처리
export async function completeRefund(
  refundId: string,
  adminMemo?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // 환불 정보 가져오기
  const { data: refund, error: fetchError } = await supabase
    .from('refunds')
    .select('order_id, amount, type')
    .eq('id', refundId)
    .single();

  if (fetchError || !refund) {
    return { success: false, error: '환불 정보를 찾을 수 없습니다.' };
  }

  // 환불 상태 업데이트
  const { error } = await supabase
    .from('refunds')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      admin_memo: adminMemo,
    })
    .eq('id', refundId);

  if (error) {
    return { success: false, error: '완료 처리에 실패했습니다.' };
  }

  // 주문 상태 업데이트 (환불의 경우)
  if (refund.type === 'refund') {
    await supabase
      .from('orders')
      .update({ status: 'refunded' })
      .eq('id', refund.order_id);
  }

  return { success: true };
}

// 반품 수거 정보 업데이트
export async function updateReturnTracking(
  refundId: string,
  trackingNumber: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('refunds')
    .update({
      tracking_number: trackingNumber,
      status: 'processing',
    })
    .eq('id', refundId);

  if (error) {
    return { success: false, error: '운송장 정보 업데이트에 실패했습니다.' };
  }

  return { success: true };
}

// 환불 요청 취소 (사용자)
export async function cancelRefundRequest(
  refundId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // 현재 상태 확인
  const { data: refund } = await supabase
    .from('refunds')
    .select('status')
    .eq('id', refundId)
    .single();

  if (!refund) {
    return { success: false, error: '환불 요청을 찾을 수 없습니다.' };
  }

  if (refund.status !== 'pending') {
    return { success: false, error: '이미 처리된 요청은 취소할 수 없습니다.' };
  }

  const { error } = await supabase
    .from('refunds')
    .update({ status: 'cancelled' })
    .eq('id', refundId);

  if (error) {
    return { success: false, error: '취소 처리에 실패했습니다.' };
  }

  return { success: true };
}

// 환불 가능 여부 확인
export async function canRequestRefund(orderId: string): Promise<{
  canRefund: boolean;
  reason?: string;
  refundableItems?: { orderItemId: string; maxQuantity: number }[];
}> {
  const supabase = createClient();

  // 주문 정보 확인
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, status, created_at')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    return { canRefund: false, reason: '주문을 찾을 수 없습니다.' };
  }

  // 상태 확인
  const refundableStatuses = ['paid', 'preparing', 'shipping', 'delivered'];
  if (!refundableStatuses.includes(order.status)) {
    return { canRefund: false, reason: '환불 가능한 주문 상태가 아닙니다.' };
  }

  // 기간 확인 (배송 완료 후 7일 이내)
  if (order.status === 'delivered') {
    const deliveredDate = new Date(order.created_at);
    const daysSinceDelivery = Math.floor(
      (Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceDelivery > 7) {
      return { canRefund: false, reason: '배송 완료 후 7일이 지나 환불이 불가능합니다.' };
    }
  }

  // 기존 환불 요청 확인
  const { data: existingRefunds } = await supabase
    .from('refunds')
    .select('items, status')
    .eq('order_id', orderId)
    .in('status', ['pending', 'approved', 'processing']);

  // 환불 가능한 상품 계산
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('id, quantity')
    .eq('order_id', orderId);

  const refundedQuantities: Record<string, number> = {};
  (existingRefunds || []).forEach((r: any) => {
    (r.items || []).forEach((item: any) => {
      refundedQuantities[item.orderItemId] =
        (refundedQuantities[item.orderItemId] || 0) + item.quantity;
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
