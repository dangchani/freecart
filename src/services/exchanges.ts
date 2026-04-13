import { createClient } from '@/lib/supabase/client';
import { ORDER_RETURNABLE_STATUSES } from '@/constants/orderStatus';
import type { OrderStatus } from '@/constants/orderStatus';
import type { ReturnableItem } from '@/services/returns';

export type ExchangeStatus = 'pending' | 'approved' | 'rejected' | 'collected' | 'reshipped' | 'completed';

export interface ExchangeItem {
  order_item_id:       string;
  quantity:            number;
  exchange_variant_id: string;
}

export interface ExchangeRequest {
  id:                   string;
  orderId:              string;
  orderNumber:          string;
  customerName:         string;
  userId:               string;
  items:                ExchangeItem[];
  itemSummary:          string;
  reason:               string;
  status:               ExchangeStatus;
  priceDiff:            number;
  initiatedBy:          'customer' | 'admin';
  adminMemo:            string | null;
  trackingNumber:       string | null;
  trackingCompanyId:    string | null;
  reshipTrackingNumber: string | null;
  reshipCompanyId:      string | null;
  approvedAt:           string | null;
  collectedAt:          string | null;
  processedAt:          string | null;
  reshippedAt:          string | null;
  completedAt:          string | null;
  createdAt:            string;
}

export const EXCHANGE_STATUS_LABELS: Record<ExchangeStatus, string> = {
  pending:   '검토중',
  approved:  '승인됨',
  rejected:  '거부됨',
  collected: '수거완료',
  reshipped: '재발송',
  completed: '완료',
};

export const EXCHANGE_REASONS: { value: string; label: string }[] = [
  { value: 'size_change',   label: '사이즈 교환' },
  { value: 'color_change',  label: '색상 교환' },
  { value: 'defective',     label: '상품 불량' },
  { value: 'wrong_product', label: '오배송' },
  { value: 'other',         label: '기타' },
];

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
      id, user_id, items, reason, status, admin_memo, price_diff, initiated_by,
      tracking_number, tracking_company_id,
      reship_tracking_number, reship_company_id,
      approved_at, collected_at, processed_at, reshipped_at, completed_at, created_at,
      order:orders(id, order_number, orderer_name, order_items(id, product_name))
    `)
    .order('created_at', { ascending: false });

  if (filters?.status)   query = query.eq('status', filters.status);
  if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters?.dateTo)   query = query.lte('created_at', filters.dateTo + 'T23:59:59');

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((e: any) => {
    const exchangeItems: ExchangeItem[] = e.items ?? [];
    const orderItems: any[] = e.order?.order_items ?? [];
    const firstItemId = exchangeItems[0]?.order_item_id;
    const firstProduct = orderItems.find((oi) => oi.id === firstItemId);
    const itemSummary = firstProduct
      ? exchangeItems.length > 1
        ? `${firstProduct.product_name} 외 ${exchangeItems.length - 1}건`
        : firstProduct.product_name
      : '';

    return {
      id:                   e.id,
      orderId:              e.order?.id ?? '',
      orderNumber:          e.order?.order_number ?? '',
      customerName:         e.order?.orderer_name ?? '',
      userId:               e.user_id,
      items:                exchangeItems,
      itemSummary,
      reason:               e.reason,
      status:               e.status,
      priceDiff:            e.price_diff ?? 0,
      initiatedBy:          e.initiated_by ?? 'customer',
      adminMemo:            e.admin_memo,
      trackingNumber:       e.tracking_number,
      trackingCompanyId:    e.tracking_company_id,
      reshipTrackingNumber: e.reship_tracking_number,
      reshipCompanyId:      e.reship_company_id,
      approvedAt:           e.approved_at,
      collectedAt:          e.collected_at,
      processedAt:          e.processed_at ?? null,
      reshippedAt:          e.reshipped_at,
      completedAt:          e.completed_at,
      createdAt:            e.created_at,
    };
  });
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
      .select('order_id, items, status')
      .eq('id', exchangeId)
      .single();

    if (fetchErr || !exc) return { success: false, error: '교환 정보를 찾을 수 없습니다.' };
    if (exc.status !== 'reshipped') return { success: false, error: '재발송 완료 상태에서만 처리할 수 있습니다.' };

    const exchangeItems: ExchangeItem[] = exc.items ?? [];
    const itemIds = exchangeItems.map((i) => i.order_item_id);

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id, product_id, variant_id, quantity, exchanged_quantity')
      .eq('order_id', exc.order_id)
      .in('id', itemIds);

    // 교환 상품 재고 사전 확인 (음수 재고 방지)
    for (const exItem of exchangeItems) {
      if (exItem.exchange_variant_id && exItem.quantity > 0) {
        const { data: variant } = await supabase
          .from('product_variants')
          .select('stock_quantity, option_text')
          .eq('id', exItem.exchange_variant_id)
          .single();
        if ((variant?.stock_quantity ?? 0) < exItem.quantity) {
          return { success: false, error: `교환 상품의 재고가 부족합니다 (${(variant as any)?.option_text ?? exItem.exchange_variant_id})` };
        }
      }
    }

    // 원 상품 재고 복구 (교환 수량 기준)
    for (const exItem of exchangeItems) {
      const orderItem = (orderItems ?? []).find((o: any) => o.id === exItem.order_item_id);
      if (!orderItem) continue;
      if (orderItem.variant_id) {
        await supabase.rpc('increment_variant_stock', {
          p_variant_id: orderItem.variant_id,
          p_quantity:   exItem.quantity,
        });
      } else {
        await supabase.rpc('increment_product_stock', {
          p_product_id: orderItem.product_id,
          p_quantity:   exItem.quantity,
        });
      }
    }

    // 교환 상품 재고 차감
    for (const exItem of exchangeItems) {
      if (exItem.exchange_variant_id && exItem.quantity > 0) {
        await supabase.rpc('decrement_variant_stock', {
          p_variant_id: exItem.exchange_variant_id,
          p_quantity:   exItem.quantity,
        });
      }
    }

    // order_items.exchanged_quantity 업데이트
    for (const exItem of exchangeItems) {
      const orderItem = (orderItems ?? []).find((o: any) => o.id === exItem.order_item_id);
      if (!orderItem) continue;

      const newExchangedQty = ((orderItem as any).exchanged_quantity ?? 0) + exItem.quantity;
      const itemUpdate: Record<string, unknown> = { exchanged_quantity: newExchangedQty };
      if (newExchangedQty >= orderItem.quantity) {
        itemUpdate.status = 'exchanged';
      }
      await supabase
        .from('order_items')
        .update(itemUpdate)
        .eq('id', orderItem.id);
    }

    const { error: updateErr } = await supabase
      .from('exchanges')
      .update({
        status:       'completed',
        completed_at: new Date().toISOString(),
        ...(adminMemo ? { admin_memo: adminMemo } : {}),
      })
      .eq('id', exchangeId);

    if (updateErr) return { success: false, error: '완료 처리에 실패했습니다.' };

    // 주문 이력 기록 (교환 완료 감사 이력)
    const { data: exchOrder } = await supabase
      .from('orders')
      .select('status')
      .eq('id', exc.order_id)
      .single();

    await supabase.from('order_status_history').insert({
      order_id:    exc.order_id,
      from_status: (exchOrder as any)?.status ?? 'delivered',
      to_status:   (exchOrder as any)?.status ?? 'delivered',
      note:        `교환 완료 처리 (exchange #${exchangeId})`,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message ?? '교환 완료 처리 중 오류가 발생했습니다.' };
  }
}

// 교환 가능 아이템 목록 조회
export async function getExchangeableItems(orderId: string): Promise<ReturnableItem[]> {
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

// 교환 시 가격 차이 계산
export async function calculatePriceDiff(
  originalUnitPrice: number,
  exchangeVariantId: string,
  quantity: number,
): Promise<{ priceDiff: number; exchangeUnitPrice: number }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('product_variants')
    .select('price')
    .eq('id', exchangeVariantId)
    .single();

  if (error || !data) return { priceDiff: 0, exchangeUnitPrice: originalUnitPrice };

  const exchangeUnitPrice = (data as any).price as number;
  const priceDiff = (exchangeUnitPrice - originalUnitPrice) * quantity;
  return { priceDiff, exchangeUnitPrice };
}

// 관리자 교환 즉시 처리 (completed 상태로 직접 생성)
export async function createAdminExchange(params: {
  orderId:      string;
  adminId:      string;
  items:        ExchangeItem[];
  reason:       string;
  description?: string;
  adminMemo?:   string;
}): Promise<{ success: boolean; error?: string; exchangeId?: string; priceDiff?: number }> {
  const supabase = createClient();

  try {
    // 1. 주문 + 아이템 조회
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, status, user_id')
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
      return { success: false, error: '현재 주문 상태에서는 교환 처리가 불가능합니다.' };
    }

    for (const exItem of params.items) {
      const orderItem = (rawItems as any[]).find((o) => o.id === exItem.order_item_id);
      if (!orderItem) return { success: false, error: `주문 아이템을 찾을 수 없습니다: ${exItem.order_item_id}` };
      if (orderItem.item_type === 'gift') return { success: false, error: '사은품은 교환 처리할 수 없습니다.' };

      const returnedQty  = orderItem.returned_quantity  ?? 0;
      const exchangedQty = orderItem.exchanged_quantity ?? 0;
      const availableQty = orderItem.quantity - returnedQty - exchangedQty;
      if (exItem.quantity > availableQty) {
        return { success: false, error: `교환 가능 수량을 초과했습니다: ${orderItem.product_name}` };
      }
      if (!exItem.exchange_variant_id) {
        return { success: false, error: `교환 상품 옵션이 지정되지 않았습니다: ${orderItem.product_name}` };
      }
    }

    // 3. price_diff 계산
    let totalPriceDiff = 0;
    for (const exItem of params.items) {
      const orderItem = (rawItems as any[]).find((o) => o.id === exItem.order_item_id);
      if (!orderItem) continue;
      const { priceDiff } = await calculatePriceDiff(
        orderItem.unit_price ?? 0,
        exItem.exchange_variant_id,
        exItem.quantity,
      );
      totalPriceDiff += priceDiff;
    }

    // 3b. 교환 상품 재고 사전 확인 (음수 재고 방지)
    for (const exItem of params.items) {
      const { data: variant } = await supabase
        .from('product_variants')
        .select('stock_quantity, option_text')
        .eq('id', exItem.exchange_variant_id)
        .single();
      if ((variant?.stock_quantity ?? 0) < exItem.quantity) {
        return { success: false, error: `교환 상품의 재고가 부족합니다 (${(variant as any)?.option_text ?? exItem.exchange_variant_id})` };
      }
    }


    // 4. exchanges 레코드 삽입
    const now = new Date().toISOString();
    const { data: inserted, error: insertErr } = await supabase
      .from('exchanges')
      .insert({
        order_id:     params.orderId,
        user_id:      (order as any).user_id,
        items:        params.items,
        reason:       params.reason,
        description:  params.description ?? null,
        status:       'completed',
        price_diff:   totalPriceDiff,
        initiated_by: 'admin',
        processed_at: now,
        completed_at: now,
        admin_memo:   params.adminMemo ?? null,
      })
      .select('id')
      .single();

    if (insertErr || !inserted) return { success: false, error: '교환 처리에 실패했습니다.' };
    const exchangeId = (inserted as any).id as string;

    // 5. 원 상품 재고 복구 + 6. 교환 상품 재고 차감 + 7. order_items 업데이트
    for (const exItem of params.items) {
      const orderItem = (rawItems as any[]).find((o) => o.id === exItem.order_item_id);
      if (!orderItem || orderItem.item_type === 'gift') continue;

      // 원 상품 재고 복구
      if (orderItem.variant_id) {
        await supabase.rpc('increment_variant_stock', {
          p_variant_id: orderItem.variant_id,
          p_quantity:   exItem.quantity,
        });
      } else {
        await supabase.rpc('increment_product_stock', {
          p_product_id: orderItem.product_id,
          p_quantity:   exItem.quantity,
        });
      }

      // 교환 상품 재고 차감
      await supabase.rpc('decrement_variant_stock', {
        p_variant_id: exItem.exchange_variant_id,
        p_quantity:   exItem.quantity,
      });

      // order_items.exchanged_quantity 업데이트
      const newExchangedQty = (orderItem.exchanged_quantity ?? 0) + exItem.quantity;
      const itemUpdate: Record<string, unknown> = { exchanged_quantity: newExchangedQty };
      if (newExchangedQty >= orderItem.quantity) {
        itemUpdate.status = 'exchanged';
      }
      await supabase
        .from('order_items')
        .update(itemUpdate)
        .eq('id', orderItem.id);
    }

    // 8. 주문 상태 이력 기록
    await supabase.from('order_status_history').insert({
      order_id:    params.orderId,
      from_status: (order as any).status,
      to_status:   (order as any).status,
      changed_by:  params.adminId,
      note:        `관리자 교환 처리 (exchange #${exchangeId}), 가격차이: ${totalPriceDiff.toLocaleString()}원`,
    });

    return { success: true, exchangeId, priceDiff: totalPriceDiff };
  } catch (err: any) {
    return { success: false, error: err.message ?? '교환 처리 중 오류가 발생했습니다.' };
  }
}
