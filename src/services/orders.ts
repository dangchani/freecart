import { createClient } from '@/lib/supabase/client';
import type { Order, OrderItem, OrderTimeline } from '@/types';
import { isValidTransition, type OrderStatus } from '@/constants/orderStatus';

function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `ORD-${year}${month}${day}-${random}`;
}

function mapOrder(order: any): Order {
  return {
    id: order.id,
    orderNumber: order.order_number,
    userId: order.user_id,
    isAdminOrder: order.is_admin_order ?? false,
    status: order.status,
    items:
      order.items?.map((item: any) => ({
        id: item.id,
        orderId: item.order_id,
        productId: item.product_id,
        variantId: item.variant_id,
        productName: item.product_name,
        optionText: item.option_text,
        productImage: item.product_image,
        unitPrice: item.unit_price,
        quantity: item.quantity,
        discountAmount: item.discount_amount,
        totalPrice: item.total_price,
        status: item.status,
      })) || [],
    subtotal: order.subtotal,
    discountAmount: order.discount_amount || 0,
    couponDiscount: order.coupon_discount || 0,
    shippingFee: order.shipping_fee || 0,
    usedPoints: order.used_points || 0,
    usedDeposit: order.used_deposit || 0,
    totalAmount: order.total_amount,
    ordererName: order.orderer_name,
    ordererPhone: order.orderer_phone,
    recipientName: order.recipient_name,
    recipientPhone: order.recipient_phone,
    postalCode: order.postal_code,
    address1: order.address1,
    address2: order.address2,
    shippingMessage: order.shipping_message,
    paymentMethod: order.payment_method,
    pgProvider: order.pg_provider,
    paidAt: order.paid_at,
    confirmedAt: order.confirmed_at,
    cancelledAt: order.cancelled_at,
    cancelReason: order.cancel_reason,
    earnedPoints: order.earned_points,
    isGift: order.is_gift,
    giftMessage: order.gift_message,
    adminMemo: order.admin_memo,
    paymentDeadline: order.payment_deadline,
    autoConfirmAt: order.auto_confirm_at,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

export async function createOrder(
  userId: string,
  items: { productId: string; variantId?: string | null; optionText?: string; productName: string; quantity: number; unitPrice: number; productImage?: string }[],
  shippingInfo: {
    ordererName: string;
    ordererPhone: string;
    recipientName: string;
    recipientPhone: string;
    postalCode: string;
    address1: string;
    address2?: string;
    shippingMessage?: string;
    // 쿠폰/포인트 정보 추가
    couponId?: string;
    couponDiscount?: number;
    pointsUsed?: number;
    extraShippingFields?: Record<string, string>;
  },
  paymentMethod: string
): Promise<Order> {
  const supabase = createClient();

  const { getShippingSettings, getPointSettings, getBankTransferSettings } = await import('@/services/settings');
  const [{ shippingFee: baseFee, freeShippingThreshold }, { earnRate }, { depositDeadlineHours }] = await Promise.all([
    getShippingSettings(),
    getPointSettings(),
    getBankTransferSettings(),
  ]);

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shippingFee = subtotal >= freeShippingThreshold ? 0 : baseFee;
  const couponDiscount = shippingInfo.couponDiscount || 0;
  const pointsUsed = shippingInfo.pointsUsed || 0;
  const totalAmount = subtotal + shippingFee - couponDiscount - pointsUsed;
  const earnedPoints = Math.floor(totalAmount * earnRate / 100);

  // 무통장·가상계좌만 입금 마감 시각 설정
  const needsDeadline = ['bank_transfer', 'virtual_account'].includes(paymentMethod);
  const paymentDeadline = needsDeadline
    ? new Date(Date.now() + depositDeadlineHours * 60 * 60 * 1000).toISOString()
    : null;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: generateOrderNumber(),
      user_id: userId,
      subtotal,
      shipping_fee: shippingFee,
      discount_amount: 0,
      coupon_id: shippingInfo.couponId || null,
      coupon_discount: couponDiscount,
      used_points: pointsUsed,
      used_deposit: 0,
      total_amount: totalAmount,
      earned_points: earnedPoints,
      payment_deadline: paymentDeadline,
      orderer_name: shippingInfo.ordererName,
      orderer_phone: shippingInfo.ordererPhone,
      recipient_name: shippingInfo.recipientName,
      recipient_phone: shippingInfo.recipientPhone,
      postal_code: shippingInfo.postalCode,
      address1: shippingInfo.address1,
      address2: shippingInfo.address2 || null,
      shipping_message: shippingInfo.shippingMessage || null,
      extra_shipping_fields: shippingInfo.extraShippingFields && Object.keys(shippingInfo.extraShippingFields).length > 0
        ? shippingInfo.extraShippingFields
        : null,
      payment_method: paymentMethod,
      status: 'pending',
    })
    .select()
    .single();

  if (orderError) throw orderError;

  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.productId,
    variant_id: item.variantId || null,
    product_name: item.productName,
    option_text: item.optionText || null,
    product_image: item.productImage || null,
    unit_price: item.unitPrice,
    quantity: item.quantity,
    discount_amount: 0,
    total_price: item.unitPrice * item.quantity,
    status: 'pending',
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) throw itemsError;

  // 재고 차감
  for (const item of items) {
    if (item.variantId) {
      await supabase.rpc('decrement_variant_stock', {
        p_variant_id: item.variantId,
        p_quantity: item.quantity,
      });
    } else {
      await supabase.rpc('decrement_product_stock', {
        p_product_id: item.productId,
        p_quantity: item.quantity,
      });
    }
  }

  // 주문 완료 이메일/알림 (fire-and-forget)
  ;(async () => {
    const { sendNotification, NOTIFICATION_TEMPLATES } = await import('@/services/notification');
    const { buildOrderPlacedEmail } = await import('@/lib/emailTemplates');
    const { getSystemSetting } = await import('@/lib/permissions');
    const siteName = (await getSystemSetting<string>('site_name')) || '쇼핑몰';
    const tpl = NOTIFICATION_TEMPLATES.order_placed;
    const { html } = buildOrderPlacedEmail({
      orderNumber:    order.order_number,
      ordererName:    shippingInfo.ordererName,
      items,
      subtotal,
      shippingFee,
      discountAmount: couponDiscount + pointsUsed,
      totalAmount,
      paymentMethod,
      paymentDeadline,
      siteName,
    });
    await sendNotification(userId, 'order_placed', tpl.title, tpl.message({ orderNumber: order.order_number }), {
      link:          `/mypage/orders/${order.order_number}`,
      sendEmail:     true,
      emailHtml:     html,
      emailTemplate: 'order_placed',
    });
  })().catch(() => {});

  // 웹훅 트리거 (fire-and-forget)
  import('@/services/webhooks').then(({ triggerWebhook }) =>
    triggerWebhook('order.created', {
      order_id:     order.id,
      order_number: order.order_number,
      user_id:      userId,
      total_amount: totalAmount,
    }),
  ).catch(() => {});

  return mapOrder({ ...order, items: [] });
}

export async function getOrders(userId: string): Promise<Order[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      items:order_items(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data?.map(mapOrder) || [];
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      items:order_items(*)
    `)
    .eq('order_number', orderNumber)
    .single();

  if (error) throw error;
  if (!data) return null;

  return mapOrder(data);
}

export async function cancelOrder(
  orderId: string,
  reason = '주문 취소',
  changedBy?: string
): Promise<void> {
  const { executeFullCancel } = await import('@/services/refundOrchestrator');
  const result = await executeFullCancel(orderId, reason, changedBy);
  if (!result.success) throw new Error(result.error ?? '취소 처리에 실패했습니다.');
}

/**
 * 주문 상태를 전이합니다.
 * - 상태 전이 유효성 검증 후 orders 업데이트
 * - order_status_history에 이력 기록
 */
export async function transitionOrderStatus(
  orderId: string,
  toStatus: OrderStatus,
  options?: {
    note?: string;
    changedBy?: string;
    trackingNumber?: string;
    shippingCompany?: string;
  }
): Promise<void> {
  const supabase = createClient();

  // 현재 상태 조회 (알림용 필드 포함)
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, status, order_number, user_id, earned_points, cancel_reason, orderer_name, total_amount')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) throw fetchError ?? new Error('주문을 찾을 수 없습니다.');

  const fromStatus = order.status as OrderStatus;

  if (!isValidTransition(fromStatus, toStatus)) {
    throw new Error(`${fromStatus} → ${toStatus} 전이는 허용되지 않습니다.`);
  }

  // 상태별 타임스탬프 컬럼
  const now = new Date().toISOString();
  const timestampPatch: Record<string, string | null> = {};
  if (toStatus === 'paid')      timestampPatch.paid_at = now;
  if (toStatus === 'confirmed') timestampPatch.confirmed_at = now;
  if (toStatus === 'cancelled') timestampPatch.cancelled_at = now;

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: toStatus, ...timestampPatch })
    .eq('id', orderId);

  if (updateError) throw updateError;

  // 상태 이력 기록
  const { error: historyError } = await supabase
    .from('order_status_history')
    .insert({
      order_id:   orderId,
      from_status: fromStatus,
      to_status:   toStatus,
      changed_by:  options?.changedBy ?? null,
      note:        options?.note ?? null,
    });

  if (historyError) throw historyError;

  // 구매확정 시 포인트 적립
  if (toStatus === 'confirmed') {
    const { awardOrderPoints } = await import('@/services/points');
    await awardOrderPoints(orderId, options?.changedBy);
  }

  // 상태별 알림 발송 (fire-and-forget)
  if (order.user_id) {
    _sendOrderNotification(order, toStatus, options).catch(() => {});
  }

  // 웹훅 트리거 (fire-and-forget) — 주요 상태 전이만 발송
  const WEBHOOK_STATUS_MAP: Partial<Record<string, string>> = {
    paid:      'order.paid',
    shipped:   'order.shipped',
    delivered: 'order.delivered',
    cancelled: 'order.cancelled',
  };
  const webhookEvent = WEBHOOK_STATUS_MAP[toStatus];
  if (webhookEvent) {
    import('@/services/webhooks').then(({ triggerWebhook }) =>
      triggerWebhook(webhookEvent, {
        order_id:     orderId,
        order_number: order.order_number,
        from_status:  fromStatus,
        to_status:    toStatus,
      }),
    ).catch(() => {});
  }
}

async function _sendOrderNotification(
  order: {
    id: string;
    user_id: string;
    order_number: string;
    earned_points?: number;
    cancel_reason?: string;
    orderer_name?: string;
    total_amount?: number;
  },
  toStatus: OrderStatus,
  options?: { trackingNumber?: string; shippingCompany?: string },
): Promise<void> {
  const { sendNotification, NOTIFICATION_TEMPLATES } = await import('@/services/notification');
  const { buildShippedEmail, buildCancelledEmail } = await import('@/lib/emailTemplates');
  const { getSystemSetting } = await import('@/lib/permissions');
  const siteName = (await getSystemSetting<string>('site_name')) || '쇼핑몰';

  const orderNumber = order.order_number;
  const userId      = order.user_id;
  const link        = `/mypage/orders/${orderNumber}`;

  switch (toStatus) {
    case 'paid': {
      const tpl = NOTIFICATION_TEMPLATES.order_paid;
      await sendNotification(userId, 'order_paid', tpl.title, tpl.message({ orderNumber }), { link });
      break;
    }
    case 'shipped': {
      const tpl = NOTIFICATION_TEMPLATES.order_shipped;
      const msg = tpl.message({ orderNumber, trackingNumber: options?.trackingNumber ?? '' });
      const { subject, html } = buildShippedEmail({
        orderNumber,
        trackingNumber:  options?.trackingNumber,
        shippingCompany: options?.shippingCompany,
        siteName,
      });
      await sendNotification(userId, 'order_shipped', tpl.title, msg, {
        link,
        sendEmail:     true,
        emailHtml:     html,
        emailTemplate: 'order_shipped',
      });
      break;
    }
    case 'delivered': {
      const tpl = NOTIFICATION_TEMPLATES.order_delivered;
      await sendNotification(userId, 'order_delivered', tpl.title, tpl.message({ orderNumber }), { link });
      break;
    }
    case 'confirmed': {
      const tpl = NOTIFICATION_TEMPLATES.point_earned;
      const pts = order.earned_points ?? 0;
      if (pts > 0) {
        await sendNotification(userId, 'point_earned', tpl.title, tpl.message({ amount: pts }), { link });
      }
      break;
    }
    case 'cancelled': {
      const tpl = NOTIFICATION_TEMPLATES.order_cancelled;
      const msg = tpl.message({ orderNumber });
      const { subject, html } = buildCancelledEmail({
        orderNumber,
        cancelReason: order.cancel_reason ?? undefined,
        ordererName:  order.orderer_name ?? undefined,
        totalAmount:  order.total_amount ?? undefined,
        siteName,
      });
      await sendNotification(userId, 'order_cancelled', tpl.title, msg, {
        link,
        sendEmail:     true,
        emailHtml:     html,
        emailTemplate: 'order_cancelled',
      });
      break;
    }
    default:
      break;
  }
}

/**
 * 주문 상태 변경 이력(타임라인)을 조회합니다.
 */
export async function getOrderTimeline(orderId: string): Promise<OrderTimeline[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('order_status_history')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id:          row.id,
    orderId:     row.order_id,
    orderItemId: row.order_item_id,
    fromStatus:  row.from_status,
    toStatus:    row.to_status,
    changedBy:   row.changed_by,
    note:        row.note,
    createdAt:   row.created_at,
  }));
}

/**
 * pending 주문의 배송지/주문자 정보를 수정합니다. (사용자·관리자 공용)
 */
export async function updateOrderShipping(
  orderId: string,
  data: {
    ordererName?: string;
    ordererPhone?: string;
    recipientName: string;
    recipientPhone: string;
    postalCode: string;
    address1: string;
    address2?: string;
    shippingMessage?: string;
  },
  changedBy?: string,
): Promise<void> {
  const supabase = createClient();

  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) throw fetchError ?? new Error('주문을 찾을 수 없습니다.');
  if (order.status !== 'pending') throw new Error('입금 전(pending) 주문만 수정할 수 있습니다.');

  const patch: Record<string, string | null> = {
    recipient_name:  data.recipientName,
    recipient_phone: data.recipientPhone,
    postal_code:     data.postalCode,
    address1:        data.address1,
    address2:        data.address2 || null,
    shipping_message: data.shippingMessage || null,
  };
  if (data.ordererName)  patch.orderer_name  = data.ordererName;
  if (data.ordererPhone) patch.orderer_phone = data.ordererPhone;

  const { error } = await supabase.from('orders').update(patch).eq('id', orderId);
  if (error) throw error;

  await supabase.from('order_status_history').insert({
    order_id:    orderId,
    from_status: 'pending',
    to_status:   'pending',
    changed_by:  changedBy ?? null,
    note:        '배송지 수정',
  });
}

/**
 * pending 주문의 상품을 수정합니다. (관리자 전용)
 * - 수량 변경, 상품 추가, 상품 삭제 지원
 * - 재고 diff 처리 및 금액 자동 재계산
 */
export async function updateOrderItems(
  orderId: string,
  editedItems: Array<{
    id?: string;
    productId: string;
    variantId?: string | null;
    productName: string;
    optionText?: string;
    unitPrice: number;
    quantity: number;
    itemType?: string;
  }>,
  changedBy?: string,
): Promise<void> {
  const supabase = createClient();

  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, status, coupon_discount, used_points, used_deposit')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) throw fetchError ?? new Error('주문을 찾을 수 없습니다.');
  if (order.status !== 'pending') throw new Error('입금 전(pending) 주문만 수정할 수 있습니다.');

  const { data: currentItems } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  const currentMap = new Map((currentItems ?? []).map((i: any) => [i.id, i]));
  const editedIdSet = new Set(editedItems.filter((i) => i.id).map((i) => i.id!));

  // 삭제된 아이템 → 재고 복구
  for (const item of currentItems ?? []) {
    if (!editedIdSet.has(item.id)) {
      if ((item.item_type ?? 'purchase') !== 'gift') {
        if (item.variant_id) {
          await supabase.rpc('increment_variant_stock', { p_variant_id: item.variant_id, p_quantity: item.quantity });
        } else {
          await supabase.rpc('increment_product_stock', { p_product_id: item.product_id, p_quantity: item.quantity });
        }
      }
      await supabase.from('order_items').delete().eq('id', item.id);
    }
  }

  // 기존 수정 + 신규 추가
  for (const item of editedItems) {
    const itemType = item.itemType ?? 'purchase';

    if (item.id && currentMap.has(item.id)) {
      const cur = currentMap.get(item.id);
      const diff = item.quantity - cur.quantity;

      if (diff !== 0 && itemType !== 'gift') {
        if (diff > 0) {
          if (item.variantId) {
            await supabase.rpc('decrement_variant_stock', { p_variant_id: item.variantId, p_quantity: diff });
          } else {
            await supabase.rpc('decrement_product_stock', { p_product_id: item.productId, p_quantity: diff });
          }
        } else {
          if (item.variantId) {
            await supabase.rpc('increment_variant_stock', { p_variant_id: item.variantId, p_quantity: -diff });
          } else {
            await supabase.rpc('increment_product_stock', { p_product_id: item.productId, p_quantity: -diff });
          }
        }
      }

      await supabase
        .from('order_items')
        .update({
          unit_price:  item.unitPrice,
          quantity:    item.quantity,
          total_price: item.unitPrice * item.quantity,
        })
        .eq('id', item.id);
    } else {
      // 신규 아이템
      await supabase.from('order_items').insert({
        order_id:       orderId,
        product_id:     item.productId,
        variant_id:     item.variantId || null,
        product_name:   item.productName,
        option_text:    item.optionText || null,
        unit_price:     item.unitPrice,
        quantity:       item.quantity,
        discount_amount: 0,
        total_price:    item.unitPrice * item.quantity,
        status:         'pending',
        item_type:      itemType,
      });

      if (itemType !== 'gift') {
        if (item.variantId) {
          await supabase.rpc('decrement_variant_stock', { p_variant_id: item.variantId, p_quantity: item.quantity });
        } else {
          await supabase.rpc('decrement_product_stock', { p_product_id: item.productId, p_quantity: item.quantity });
        }
      }
    }
  }

  // 금액 재계산
  const { getShippingSettings, getPointSettings } = await import('@/services/settings');
  const [{ shippingFee: baseFee, freeShippingThreshold }, { earnRate }] = await Promise.all([
    getShippingSettings(),
    getPointSettings(),
  ]);

  const newSubtotal    = editedItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const newShippingFee = newSubtotal >= freeShippingThreshold ? 0 : baseFee;
  const couponDiscount = order.coupon_discount ?? 0;
  const usedPoints     = order.used_points     ?? 0;
  const usedDeposit    = order.used_deposit    ?? 0;
  const newTotal       = Math.max(0, newSubtotal + newShippingFee - couponDiscount - usedPoints - usedDeposit);
  const newEarned      = Math.floor(newTotal * earnRate / 100);

  await supabase.from('orders').update({
    subtotal:      newSubtotal,
    shipping_fee:  newShippingFee,
    total_amount:  newTotal,
    earned_points: newEarned,
  }).eq('id', orderId);

  await supabase.from('order_status_history').insert({
    order_id:    orderId,
    from_status: 'pending',
    to_status:   'pending',
    changed_by:  changedBy ?? null,
    note:        '주문 상품 수정',
  });
}

/**
 * 관리자가 직접 주문을 생성합니다.
 */
export async function createAdminOrder(
  data: {
    userId?: string | null;
    ordererName: string;
    ordererPhone: string;
    recipientName: string;
    recipientPhone: string;
    postalCode: string;
    address1: string;
    address2?: string;
    shippingMessage?: string;
    items: Array<{
      productId: string;
      variantId?: string | null;
      productName: string;
      optionText?: string;
      productImage?: string;
      quantity: number;
      unitPrice: number;
      itemType?: string;
    }>;
    paymentMethod: string;
    discountAmount?: number;
    shippingFeeOverride?: number | null;
    adminMemo?: string;
    initialStatus?: 'pending' | 'paid';
  },
  adminId: string,
): Promise<Order> {
  const supabase = createClient();

  const { getShippingSettings, getPointSettings, getBankTransferSettings } = await import('@/services/settings');
  const [
    { shippingFee: baseFee, freeShippingThreshold },
    { earnRate },
    { depositDeadlineHours },
  ] = await Promise.all([getShippingSettings(), getPointSettings(), getBankTransferSettings()]);

  const purchaseItems = data.items.filter((i) => (i.itemType ?? 'purchase') !== 'gift');
  const subtotal      = purchaseItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const shippingFee   = data.shippingFeeOverride != null
    ? data.shippingFeeOverride
    : (subtotal >= freeShippingThreshold ? 0 : baseFee);
  const discountAmount = data.discountAmount ?? 0;
  const totalAmount    = Math.max(0, subtotal + shippingFee - discountAmount);
  const earnedPoints   = Math.floor(totalAmount * earnRate / 100);
  const initialStatus  = data.initialStatus ?? 'pending';

  const needsDeadline  = ['bank_transfer', 'virtual_account'].includes(data.paymentMethod) && initialStatus === 'pending';
  const paymentDeadline = needsDeadline
    ? new Date(Date.now() + depositDeadlineHours * 60 * 60 * 1000).toISOString()
    : null;
  const now = new Date().toISOString();

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number:     generateOrderNumber(),
      user_id:          data.userId || null,
      subtotal,
      shipping_fee:     shippingFee,
      discount_amount:  discountAmount,
      coupon_discount:  0,
      used_points:      0,
      used_deposit:     0,
      total_amount:     totalAmount,
      earned_points:    earnedPoints,
      payment_deadline: paymentDeadline,
      orderer_name:     data.ordererName,
      orderer_phone:    data.ordererPhone,
      recipient_name:   data.recipientName,
      recipient_phone:  data.recipientPhone,
      postal_code:      data.postalCode,
      address1:         data.address1,
      address2:         data.address2 || null,
      shipping_message: data.shippingMessage || null,
      payment_method:   data.paymentMethod,
      status:           initialStatus,
      paid_at:          initialStatus === 'paid' ? now : null,
      admin_memo:       data.adminMemo || null,
      is_admin_order:   true,
    })
    .select()
    .single();

  if (orderError) throw orderError;

  const orderItems = data.items.map((item) => ({
    order_id:        order.id,
    product_id:      item.productId,
    variant_id:      item.variantId || null,
    product_name:    item.productName,
    option_text:     item.optionText || null,
    product_image:   item.productImage || null,
    unit_price:      item.unitPrice,
    quantity:        item.quantity,
    discount_amount: 0,
    total_price:     item.unitPrice * item.quantity,
    status:          initialStatus,
    item_type:       item.itemType || 'purchase',
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) throw itemsError;

  for (const item of data.items) {
    if ((item.itemType ?? 'purchase') === 'gift') continue;
    if (item.variantId) {
      await supabase.rpc('decrement_variant_stock', { p_variant_id: item.variantId, p_quantity: item.quantity });
    } else {
      await supabase.rpc('decrement_product_stock', { p_product_id: item.productId, p_quantity: item.quantity });
    }
  }

  await supabase.from('order_status_history').insert({
    order_id:    order.id,
    from_status: null,
    to_status:   initialStatus,
    changed_by:  adminId,
    note:        '관리자 직접 생성',
  });

  if (data.userId) {
    const userId = data.userId;
    ;(async () => {
      const { sendNotification, NOTIFICATION_TEMPLATES } = await import('@/services/notification');
      const { buildOrderPlacedEmail } = await import('@/lib/emailTemplates');
      const { getSystemSetting } = await import('@/lib/permissions');
      const siteName = (await getSystemSetting<string>('site_name')) || '쇼핑몰';
      const tpl = NOTIFICATION_TEMPLATES.order_placed;
      const { html } = buildOrderPlacedEmail({
        orderNumber:    order.order_number,
        ordererName:    data.ordererName,
        items:          purchaseItems,
        subtotal,
        shippingFee,
        discountAmount,
        totalAmount,
        paymentMethod:  data.paymentMethod,
        paymentDeadline,
        siteName,
      });
      await sendNotification(userId, 'order_placed', tpl.title, tpl.message({ orderNumber: order.order_number }), {
        link:          `/mypage/orders/${order.order_number}`,
        sendEmail:     true,
        emailHtml:     html,
        emailTemplate: 'order_placed',
      });
    })().catch(() => {});
  }

  return mapOrder({ ...order, items: [] });
}
