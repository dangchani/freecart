import { createClient } from '@/lib/supabase/client';

export interface Coupon {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number;
  expiresAt: string | null;
}

export interface UserCoupon {
  id: string;
  couponId: string;
  status: string;
  isUsed: boolean;
  expiresAt: string;
  coupon: Coupon;
}

/**
 * 사용자의 사용 가능한 쿠폰 목록 조회
 */
export async function getUserCoupons(userId: string): Promise<UserCoupon[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('user_coupons')
    .select(`
      *,
      coupon:coupons(*)
    `)
    .eq('user_id', userId)
    .eq('is_used', false)
    .gte('expires_at', new Date().toISOString());

  if (error) throw error;

  return (data || [])
    .filter((uc: any) => uc.coupon !== null)
    .map((uc: any) => ({
      id: uc.id,
      couponId: uc.coupon_id,
      status: uc.status,
      isUsed: uc.is_used,
      expiresAt: uc.expires_at,
      coupon: {
        id: uc.coupon.id,
        code: uc.coupon.code,
        name: uc.coupon.name,
        description: uc.coupon.description,
        discountType: uc.coupon.discount_type,
        discountValue: uc.coupon.discount_value,
        maxDiscountAmount: uc.coupon.max_discount_amount,
        minOrderAmount: uc.coupon.min_order_amount,
        expiresAt: uc.coupon.expires_at,
      },
    }));
}

/**
 * 쿠폰 적용 가능 여부 확인 및 할인 금액 계산
 */
export function calculateCouponDiscount(
  coupon: Coupon,
  orderAmount: number
): { applicable: boolean; discount: number; reason?: string } {
  // 최소 주문 금액 체크
  if (orderAmount < coupon.minOrderAmount) {
    return {
      applicable: false,
      discount: 0,
      reason: `최소 주문 금액 ${coupon.minOrderAmount.toLocaleString()}원 이상이어야 합니다.`,
    };
  }

  // 할인 금액 계산
  let discount = 0;
  if (coupon.discountType === 'percentage') {
    discount = Math.floor(orderAmount * (coupon.discountValue / 100));
    // 최대 할인 금액 제한
    if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
      discount = coupon.maxDiscountAmount;
    }
  } else {
    // 정액 할인
    discount = coupon.discountValue;
  }

  // 할인 금액이 주문 금액을 초과하지 않도록
  if (discount > orderAmount) {
    discount = orderAmount;
  }

  return { applicable: true, discount };
}

/**
 * 쿠폰 코드로 쿠폰 등록
 */
export async function registerCouponByCode(userId: string, code: string): Promise<{ success: boolean; message: string }> {
  const supabase = createClient();

  // 쿠폰 조회
  const { data: coupon, error: couponError } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .single();

  if (couponError || !coupon) {
    return { success: false, message: '유효하지 않은 쿠폰 코드입니다.' };
  }

  // 만료 확인
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return { success: false, message: '만료된 쿠폰입니다.' };
  }

  // 시작일 확인
  if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
    return { success: false, message: '아직 사용 기간이 아닙니다.' };
  }

  // 수량 제한 확인
  if (coupon.total_quantity && coupon.used_quantity >= coupon.total_quantity) {
    return { success: false, message: '쿠폰이 모두 소진되었습니다.' };
  }

  // 이미 등록 여부 확인
  const { data: existing } = await supabase
    .from('user_coupons')
    .select('id')
    .eq('user_id', userId)
    .eq('coupon_id', coupon.id)
    .single();

  if (existing) {
    return { success: false, message: '이미 등록된 쿠폰입니다.' };
  }

  // 쿠폰 등록
  const expiresAt = coupon.expires_at || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase
    .from('user_coupons')
    .insert({
      user_id: userId,
      coupon_id: coupon.id,
      expires_at: expiresAt,
    });

  if (insertError) {
    return { success: false, message: '쿠폰 등록에 실패했습니다.' };
  }

  return { success: true, message: '쿠폰이 등록되었습니다.' };
}

/**
 * 쿠폰 사용 처리 (주문 완료 시 호출)
 */
export async function useCoupon(userCouponId: string, orderId?: string): Promise<void> {
  const supabase = createClient();

  // 사용 처리
  await supabase
    .from('user_coupons')
    .update({
      is_used: true,
      used_at: new Date().toISOString(),
      status: 'used',
    })
    .eq('id', userCouponId);

  // 사용 이력 기록
  if (orderId) {
    const { data: userCoupon } = await supabase
      .from('user_coupons')
      .select('user_id, coupon_id')
      .eq('id', userCouponId)
      .single();

    if (userCoupon) {
      await supabase.from('coupon_usages').insert({
        user_coupon_id: userCouponId,
        coupon_id: userCoupon.coupon_id,
        user_id: userCoupon.user_id,
        order_id: orderId,
        used_at: new Date().toISOString(),
      }).then(() => {
        // 쿠폰 사용 횟수 증가
        supabase.rpc('increment_coupon_used_count', { coupon_id_input: userCoupon.coupon_id });
      });
    }
  }
}
