import { createClient } from '@/lib/supabase/client';

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired';
export type SubscriptionCycle = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly';

export interface Subscription {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  productImage?: string;
  variantInfo?: string;
  quantity: number;
  cycle: SubscriptionCycle;
  price: number;
  discountRate: number;
  discountedPrice: number;
  status: SubscriptionStatus;
  nextDeliveryDate: string;
  lastDeliveryDate?: string;
  deliveryCount: number;
  shippingAddressId: string;
  paymentMethodId?: string;
  createdAt: string;
}

export interface SubscriptionProduct {
  productId: string;
  availableCycles: SubscriptionCycle[];
  discountRates: Record<SubscriptionCycle, number>;
  minQuantity: number;
  maxQuantity: number;
}

export const CYCLE_LABELS: Record<SubscriptionCycle, string> = {
  weekly: '매주',
  biweekly: '2주마다',
  monthly: '매월',
  bimonthly: '2개월마다',
  quarterly: '3개월마다',
};

export const CYCLE_DAYS: Record<SubscriptionCycle, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  bimonthly: 60,
  quarterly: 90,
};

// 정기구독 상품 정보 조회
export async function getSubscriptionProduct(productId: string): Promise<SubscriptionProduct | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('subscription_products')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  return {
    productId: data.product_id,
    availableCycles: data.available_cycles,
    discountRates: data.discount_rates,
    minQuantity: data.min_quantity || 1,
    maxQuantity: data.max_quantity || 10,
  };
}

// 정기구독 신청
export async function createSubscription(params: {
  userId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  cycle: SubscriptionCycle;
  shippingAddressId: string;
  paymentMethodId?: string;
  startDate?: string;
}): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
  const supabase = createClient();

  // 상품 정보 조회
  const { data: product } = await supabase
    .from('products')
    .select('id, name, sale_price, product_images(url)')
    .eq('id', params.productId)
    .single();

  if (!product) {
    return { success: false, error: '상품을 찾을 수 없습니다.' };
  }

  // 정기구독 할인율 조회
  const subProduct = await getSubscriptionProduct(params.productId);
  const discountRate = subProduct?.discountRates[params.cycle] || 0;
  const discountedPrice = Math.floor(product.sale_price * (1 - discountRate / 100)) * params.quantity;

  // 첫 배송일 계산
  const startDate = params.startDate ? new Date(params.startDate) : new Date();
  startDate.setDate(startDate.getDate() + 3); // 3일 후 첫 배송

  const { data: subscription, error } = await supabase
    .from('user_subscriptions')
    .insert({
      user_id: params.userId,
      product_id: params.productId,
      variant_id: params.variantId,
      quantity: params.quantity,
      cycle: params.cycle,
      price: product.sale_price * params.quantity,
      discount_rate: discountRate,
      discounted_price: discountedPrice,
      status: 'active',
      next_delivery_date: startDate.toISOString(),
      delivery_count: 0,
      shipping_address_id: params.shippingAddressId,
      payment_method_id: params.paymentMethodId,
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: '정기구독 신청에 실패했습니다.' };
  }

  return { success: true, subscriptionId: subscription.id };
}

// 내 정기구독 목록
export async function getMySubscriptions(userId: string): Promise<Subscription[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('user_subscriptions')
    .select(`
      id, quantity, cycle, price, discount_rate, discounted_price, status,
      next_delivery_date, last_delivery_date, delivery_count,
      shipping_address_id, payment_method_id, created_at,
      products(id, name, product_images(url)),
      product_variants(option_values)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((s: any) => ({
    id: s.id,
    userId,
    productId: s.products.id,
    productName: s.products.name,
    productImage: s.products.product_images?.[0]?.url,
    variantInfo: s.product_variants?.option_values
      ? Object.values(s.product_variants.option_values).join(' / ')
      : undefined,
    quantity: s.quantity,
    cycle: s.cycle,
    price: s.price,
    discountRate: s.discount_rate,
    discountedPrice: s.discounted_price,
    status: s.status,
    nextDeliveryDate: s.next_delivery_date,
    lastDeliveryDate: s.last_delivery_date,
    deliveryCount: s.delivery_count,
    shippingAddressId: s.shipping_address_id,
    paymentMethodId: s.payment_method_id,
    createdAt: s.created_at,
  }));
}

// 정기구독 일시정지
export async function pauseSubscription(
  subscriptionId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('user_subscriptions')
    .update({ status: 'paused' })
    .eq('id', subscriptionId)
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    return { success: false, error: '일시정지에 실패했습니다.' };
  }

  return { success: true };
}

// 정기구독 재개
export async function resumeSubscription(
  subscriptionId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // 다음 배송일 재계산
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('cycle')
    .eq('id', subscriptionId)
    .single();

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + CYCLE_DAYS[sub?.cycle as SubscriptionCycle] || 30);

  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'active',
      next_delivery_date: nextDate.toISOString(),
    })
    .eq('id', subscriptionId)
    .eq('user_id', userId)
    .eq('status', 'paused');

  if (error) {
    return { success: false, error: '재개에 실패했습니다.' };
  }

  return { success: true };
}

// 정기구독 해지
export async function cancelSubscription(
  subscriptionId: string,
  userId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'cancelled',
      cancel_reason: reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: '해지에 실패했습니다.' };
  }

  return { success: true };
}

// 정기구독 수정
export async function updateSubscription(
  subscriptionId: string,
  userId: string,
  updates: {
    quantity?: number;
    cycle?: SubscriptionCycle;
    shippingAddressId?: string;
    nextDeliveryDate?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const updateData: any = {};

  if (updates.quantity) updateData.quantity = updates.quantity;
  if (updates.cycle) updateData.cycle = updates.cycle;
  if (updates.shippingAddressId) updateData.shipping_address_id = updates.shippingAddressId;
  if (updates.nextDeliveryDate) updateData.next_delivery_date = updates.nextDeliveryDate;

  // 수량이나 주기 변경 시 가격 재계산
  if (updates.quantity || updates.cycle) {
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('product_id, quantity, cycle, discount_rate')
      .eq('id', subscriptionId)
      .single();

    const { data: product } = await supabase
      .from('products')
      .select('sale_price')
      .eq('id', sub?.product_id)
      .single();

    const qty = updates.quantity || sub?.quantity || 1;
    const newCycle = updates.cycle || sub?.cycle;

    const subProduct = await getSubscriptionProduct(sub?.product_id);
    const discountRate = subProduct?.discountRates[newCycle as SubscriptionCycle] || 0;

    updateData.discount_rate = discountRate;
    updateData.price = (product?.sale_price || 0) * qty;
    updateData.discounted_price = Math.floor(updateData.price * (1 - discountRate / 100));
  }

  const { error } = await supabase
    .from('user_subscriptions')
    .update(updateData)
    .eq('id', subscriptionId)
    .eq('user_id', userId);

  if (error) {
    return { success: false, error: '수정에 실패했습니다.' };
  }

  return { success: true };
}

// 다음 배송 건너뛰기
export async function skipNextDelivery(
  subscriptionId: string,
  userId: string
): Promise<{ success: boolean; newDate?: string; error?: string }> {
  const supabase = createClient();

  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('cycle, next_delivery_date')
    .eq('id', subscriptionId)
    .eq('user_id', userId)
    .single();

  if (!sub) {
    return { success: false, error: '구독 정보를 찾을 수 없습니다.' };
  }

  const currentDate = new Date(sub.next_delivery_date);
  currentDate.setDate(currentDate.getDate() + CYCLE_DAYS[sub.cycle as SubscriptionCycle]);

  const { error } = await supabase
    .from('user_subscriptions')
    .update({ next_delivery_date: currentDate.toISOString() })
    .eq('id', subscriptionId);

  if (error) {
    return { success: false, error: '배송일 변경에 실패했습니다.' };
  }

  return { success: true, newDate: currentDate.toISOString() };
}
