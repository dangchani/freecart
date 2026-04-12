/**
 * 취소/환불 오케스트레이션
 * - 결제수단별 PG 환불 분기
 * - 재고 복구
 * - 포인트 복구
 * - 예치금 복구
 * - 쿠폰 복구
 * - 상태 이력 기록
 */
import { createClient } from '@/lib/supabase/client';
import { restorePoints } from '@/services/points';
import { restoreCoupon } from '@/services/coupons';
import { transitionOrderStatus } from '@/services/orders';
import { cancelPayment } from '@/services/payment';
import type { OrderStatus } from '@/constants/orderStatus';

export interface CancelItem {
  orderItemId: string;
  quantity: number;
}

export interface CancelResult {
  success: boolean;
  error?: string;
  pgRefunded?: boolean;
  stockRestored?: boolean;
  pointsRestored?: number;
  depositRestored?: number;
  couponRestored?: boolean;
}

/**
 * 전체/부분 취소 실행
 *
 * @param orderId      대상 주문 ID
 * @param reason       취소 사유
 * @param changedBy    처리 관리자 ID
 * @param items        부분취소 시 대상 items (생략 시 전체 취소)
 */
export async function executeFullCancel(
  orderId: string,
  reason: string,
  changedBy?: string,
  items?: CancelItem[]
): Promise<CancelResult> {
  const supabase = createClient();
  const result: CancelResult = { success: false };
  const isPartial = !!items && items.length > 0;

  try {
    // 1. 주문 정보 로드
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(`
        id, status, user_id, payment_method,
        used_points, used_deposit, coupon_id,
        total_amount, items:order_items(*)
      `)
      .eq('id', orderId)
      .single();

    if (orderErr || !order) throw new Error('주문을 찾을 수 없습니다.');

    // 2. 결제 정보 로드 (PG 환불용 payment_key)
    const { data: payment } = await supabase
      .from('payments')
      .select('id, payment_key, pg_provider, method, amount, status')
      .eq('order_id', orderId)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. 취소 대상 아이템 결정
    const targetItems: Array<{ orderItemId: string; quantity: number; variantId: string | null; productId: string; totalPrice: number; itemType: string }> =
      isPartial
        ? items!.map((ci) => {
            const oi = (order.items as any[]).find((x: any) => x.id === ci.orderItemId);
            return {
              orderItemId: ci.orderItemId,
              quantity: ci.quantity,
              variantId: oi?.variant_id ?? null,
              productId: oi?.product_id ?? '',
              totalPrice: oi ? Math.round((oi.total_price / oi.quantity) * ci.quantity) : 0,
              itemType: oi?.item_type ?? 'purchase',
            };
          })
        : (order.items as any[]).map((oi: any) => ({
            orderItemId: oi.id,
            quantity: oi.quantity,
            variantId: oi.variant_id,
            productId: oi.product_id,
            totalPrice: oi.total_price,
            itemType: oi.item_type ?? 'purchase',
          }));

    const cancelAmount = targetItems.reduce((sum, i) => sum + i.totalPrice, 0);

    // 4. PG 환불 (카드 / 가상계좌)
    if (payment?.payment_key && ['card', 'virtual_account'].includes(order.payment_method ?? '')) {
      const pgResult = await cancelPayment(
        payment.pg_provider as any,
        payment.payment_key,
        reason,
        isPartial ? cancelAmount : undefined
      );
      result.pgRefunded = pgResult.success;

      if (!pgResult.success && !isPartial) {
        // 전체 취소 시 PG 실패하면 중단
        return { success: false, error: `PG 환불 실패: ${pgResult.error}` };
      }

      // payment 상태 업데이트
      await supabase
        .from('payments')
        .update({ status: isPartial ? 'partial_cancelled' : 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', payment.id);
    }

    // 5. 재고 복구 (사은품 제외)
    for (const item of targetItems) {
      if (item.itemType === 'gift') continue;
      if (item.variantId) {
        await supabase.rpc('increment_variant_stock', { p_variant_id: item.variantId, p_quantity: item.quantity });
      } else if (item.productId) {
        await supabase.rpc('increment_product_stock', { p_product_id: item.productId, p_quantity: item.quantity });
      }
    }
    result.stockRestored = true;

    // 6. 전체 취소인 경우만 포인트/예치금/쿠폰 복구
    if (!isPartial && order.user_id) {
      // 포인트 복구
      if ((order.used_points ?? 0) > 0) {
        await restorePoints(order.user_id, order.used_points, orderId);
        result.pointsRestored = order.used_points;
      }

      // 예치금 복구
      if ((order.used_deposit ?? 0) > 0) {
        await supabase.rpc('increment_user_deposit', { p_user_id: order.user_id, p_amount: order.used_deposit });
        result.depositRestored = order.used_deposit;
      }

      // 쿠폰 복구
      if (order.coupon_id) {
        await restoreCoupon(orderId);
        result.couponRestored = true;
      }
    }

    // 7. 주문 상태 전이 (전체 취소만)
    if (!isPartial) {
      await transitionOrderStatus(orderId, 'cancelled' as OrderStatus, {
        note: reason,
        changedBy,
      });
      await supabase.from('orders').update({ cancel_reason: reason }).eq('id', orderId);
    } else {
      // 부분 취소: order_status_history에만 기록
      await supabase.from('order_status_history').insert({
        order_id: orderId,
        from_status: order.status,
        to_status: order.status,
        changed_by: changedBy ?? null,
        note: `부분 취소: ${targetItems.map((i) => i.orderItemId).join(', ')} / 금액: ${cancelAmount.toLocaleString()}원`,
      });
    }

    result.success = true;
    return result;
  } catch (err: any) {
    console.error('executeFullCancel error:', err);
    return { success: false, error: err.message ?? '취소 처리 중 오류가 발생했습니다.' };
  }
}

/**
 * 환불 완료 처리 (관리자 승인 후 실행)
 * completeRefund()에서 호출되어 자원 복구까지 처리
 */
export async function executeRefundComplete(
  refundId: string,
  changedBy?: string
): Promise<CancelResult> {
  const supabase = createClient();

  try {
    const { data: refund, error } = await supabase
      .from('refunds')
      .select('order_id, amount, type, items, status')
      .eq('id', refundId)
      .single();

    if (error || !refund) throw new Error('환불 정보를 찾을 수 없습니다.');
    if (refund.status !== 'approved') throw new Error('승인된 환불만 완료 처리할 수 있습니다.');

    const items: CancelItem[] = (refund.items ?? []).map((i: any) => ({
      orderItemId: i.orderItemId,
      quantity: i.quantity,
    }));

    // 부분 환불이면 isPartial=true, 전체 환불이면 false
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id')
      .eq('order_id', refund.order_id);

    const totalItemCount = orderItems?.length ?? 0;
    const isPartial = items.length > 0 && items.length < totalItemCount;

    return await executeFullCancel(
      refund.order_id,
      `환불 완료 처리 (refund #${refundId})`,
      changedBy,
      isPartial ? items : undefined
    );
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
