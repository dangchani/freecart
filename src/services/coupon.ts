import { createClient } from '@/lib/supabase/client';

export type CouponType = 'percent' | 'fixed' | 'free_shipping';
export type CouponTarget = 'all' | 'category' | 'product' | 'brand' | 'new_member' | 'birthday';

export interface Coupon {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: CouponType;
  value: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  target: CouponTarget;
  targetIds?: string[];
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number;
  usageCount: number;
  perUserLimit: number;
  isActive: boolean;
  isPublic: boolean;
}

export interface UserCoupon {
  id: string;
  coupon: Coupon;
  usedAt?: string;
  expiresAt?: string;
  isUsed: boolean;
}

// 쿠폰 적용 가능 여부 확인
export async function validateCoupon(
  couponCode: string,
  userId: string,
  orderAmount: number,
  productIds: string[],
  categoryIds: string[]
): Promise<{ valid: boolean; coupon?: Coupon; discount?: number; error?: string }> {
  const supabase = createClient();

  // 쿠폰 조회
  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', couponCode.toUpperCase())
    .eq('is_active', true)
    .single();

  if (error || !coupon) {
    return { valid: false, error: '유효하지 않은 쿠폰입니다.' };
  }

  // 기간 확인
  const now = new Date();
  if (coupon.starts_at && new Date(coupon.starts_at) > now) {
    return { valid: false, error: '아직 사용할 수 없는 쿠폰입니다.' };
  }
  if (coupon.ends_at && new Date(coupon.ends_at) < now) {
    return { valid: false, error: '만료된 쿠폰입니다.' };
  }

  // 최소 주문 금액 확인
  if (orderAmount < coupon.min_order_amount) {
    return { valid: false, error: `${coupon.min_order_amount.toLocaleString()}원 이상 주문 시 사용 가능합니다.` };
  }

  // 전체 사용 횟수 확인
  if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
    return { valid: false, error: '쿠폰 사용 한도가 초과되었습니다.' };
  }

  // 사용자별 사용 횟수 확인
  const { count: userUsageCount } = await supabase
    .from('coupon_usages')
    .select('*', { count: 'exact', head: true })
    .eq('coupon_id', coupon.id)
    .eq('user_id', userId);

  if (coupon.usage_limit_per_user && (userUsageCount || 0) >= coupon.usage_limit_per_user) {
    return { valid: false, error: '이미 사용하신 쿠폰입니다.' };
  }

  // 대상 확인
  if (coupon.target_type === 'category' && coupon.target_ids) {
    const hasMatch = coupon.target_ids.some((id: string) => categoryIds.includes(id));
    if (!hasMatch) {
      return { valid: false, error: '해당 상품에 적용할 수 없는 쿠폰입니다.' };
    }
  }

  if (coupon.target_type === 'product' && coupon.target_ids) {
    const hasMatch = coupon.target_ids.some((id: string) => productIds.includes(id));
    if (!hasMatch) {
      return { valid: false, error: '해당 상품에 적용할 수 없는 쿠폰입니다.' };
    }
  }

  // 할인 금액 계산
  let discount = 0;
  if (coupon.discount_type === 'percent') {
    discount = Math.floor(orderAmount * (coupon.discount_value / 100));
    if (coupon.max_discount_amount) {
      discount = Math.min(discount, coupon.max_discount_amount);
    }
  } else if (coupon.discount_type === 'fixed') {
    discount = coupon.discount_value;
  }

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      description: coupon.description,
      type: coupon.discount_type as CouponType,
      value: coupon.discount_value,
      minOrderAmount: coupon.min_order_amount,
      maxDiscountAmount: coupon.max_discount_amount,
      target: coupon.target_type,
      targetIds: coupon.target_ids,
      startsAt: coupon.starts_at,
      endsAt: coupon.ends_at,
      usageLimit: coupon.usage_limit,
      usageCount: coupon.used_count,
      perUserLimit: coupon.usage_limit_per_user,
      isActive: coupon.is_active,
      isPublic: coupon.is_public,
    },
    discount,
  };
}

// 쿠폰 사용 처리
export async function useCoupon(
  couponId: string,
  userId: string,
  orderId: string,
  discountAmount: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // 사용 기록 추가
  const { error: usageError } = await supabase.from('coupon_usages').insert({
    coupon_id: couponId,
    user_id: userId,
    order_id: orderId,
    discount_amount: discountAmount,
  });

  if (usageError) {
    return { success: false, error: '쿠폰 사용 처리에 실패했습니다.' };
  }

  // 사용 횟수 증가
  await supabase.rpc('increment_coupon_usage', { coupon_id: couponId });

  return { success: true };
}

// 쿠폰 사용 취소
export async function cancelCouponUsage(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // 사용 기록 조회
  const { data: usage } = await supabase
    .from('coupon_usages')
    .select('coupon_id')
    .eq('order_id', orderId)
    .single();

  if (!usage) return { success: true };

  // 사용 기록 삭제
  await supabase.from('coupon_usages').delete().eq('order_id', orderId);

  // 사용 횟수 감소
  await supabase.rpc('decrement_coupon_usage', { coupon_id: usage.coupon_id });

  return { success: true };
}

// 내 쿠폰 목록
export async function getMyCoupons(userId: string): Promise<UserCoupon[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('user_coupons')
    .select(`
      id, used_at, expires_at,
      coupons(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((uc: any) => ({
    id: uc.id,
    coupon: {
      id: uc.coupons.id,
      code: uc.coupons.code,
      name: uc.coupons.name,
      description: uc.coupons.description,
      type: uc.coupons.discount_type,
      value: uc.coupons.discount_value,
      minOrderAmount: uc.coupons.min_order_amount,
      maxDiscountAmount: uc.coupons.max_discount_amount,
      target: uc.coupons.target_type,
      targetIds: uc.coupons.target_ids,
      startsAt: uc.coupons.starts_at,
      endsAt: uc.coupons.ends_at,
      usageLimit: uc.coupons.usage_limit,
      usageCount: uc.coupons.used_count,
      perUserLimit: uc.coupons.usage_limit_per_user,
      isActive: uc.coupons.is_active,
      isPublic: uc.coupons.is_public,
    },
    usedAt: uc.used_at,
    expiresAt: uc.expires_at,
    isUsed: !!uc.used_at,
  }));
}

// 쿠폰 발급
export async function issueCoupon(
  couponId: string,
  userId: string,
  expiresInDays?: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // 이미 발급받았는지 확인
  const { data: existing } = await supabase
    .from('user_coupons')
    .select('id')
    .eq('coupon_id', couponId)
    .eq('user_id', userId)
    .single();

  if (existing) {
    return { success: false, error: '이미 발급받은 쿠폰입니다.' };
  }

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { error } = await supabase.from('user_coupons').insert({
    coupon_id: couponId,
    user_id: userId,
    expires_at: expiresAt,
  });

  if (error) {
    return { success: false, error: '쿠폰 발급에 실패했습니다.' };
  }

  return { success: true };
}

// 다운로드 가능한 쿠폰 목록
export async function getAvailableCoupons(userId: string): Promise<Coupon[]> {
  const supabase = createClient();
  const now = new Date().toISOString();

  // 공개 쿠폰 조회
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('is_active', true)
    .eq('is_public', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`);

  if (error || !data) return [];

  // 이미 발급받은 쿠폰 필터링
  const { data: userCoupons } = await supabase
    .from('user_coupons')
    .select('coupon_id')
    .eq('user_id', userId);

  const issuedCouponIds = new Set((userCoupons || []).map((uc: any) => uc.coupon_id));

  return data
    .filter((c: any) => !issuedCouponIds.has(c.id))
    .map((c: any) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      description: c.description,
      type: c.discount_type,
      value: c.discount_value,
      minOrderAmount: c.min_order_amount,
      maxDiscountAmount: c.max_discount_amount,
      target: c.target_type,
      targetIds: c.target_ids,
      startsAt: c.starts_at,
      endsAt: c.ends_at,
      usageLimit: c.usage_limit,
      usageCount: c.used_count,
      perUserLimit: c.usage_limit_per_user,
      isActive: c.is_active,
      isPublic: c.is_public,
    }));
}
