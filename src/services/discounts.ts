import { createClient } from '@/lib/supabase/client';

export interface QuantityDiscount {
  id: string;
  productId: string;
  minQuantity: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
}

export interface TimeSale {
  id: string;
  productId: string;
  name: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

// 상품의 수량별 할인 조회
export async function getQuantityDiscounts(productId: string): Promise<QuantityDiscount[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from('product_quantity_discounts')
    .select('id, product_id, min_quantity, discount_type, discount_value')
    .eq('product_id', productId)
    .order('min_quantity', { ascending: true });

  return (data || []).map((d: any) => ({
    id: d.id,
    productId: d.product_id,
    minQuantity: d.min_quantity,
    discountType: d.discount_type,
    discountValue: d.discount_value,
  }));
}

// 상품의 현재 활성 타임세일 조회
export async function getActiveTimeSale(productId: string): Promise<TimeSale | null> {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('product_discounts')
    .select('id, product_id, name, discount_type, discount_value, starts_at, ends_at, is_active')
    .eq('product_id', productId)
    .eq('is_active', true)
    .lte('starts_at', now)
    .gte('ends_at', now)
    .order('discount_value', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    productId: data.product_id,
    name: data.name,
    discountType: data.discount_type,
    discountValue: data.discount_value,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    isActive: data.is_active,
  };
}

// 수량별 할인 계산
export function calculateQuantityDiscount(
  basePrice: number,
  quantity: number,
  discounts: QuantityDiscount[]
): { unitPrice: number; discount: number; appliedDiscount: QuantityDiscount | null } {
  if (discounts.length === 0) {
    return { unitPrice: basePrice, discount: 0, appliedDiscount: null };
  }

  // 현재 수량에 적용 가능한 가장 높은 할인 찾기
  const applicableDiscount = discounts
    .filter((d) => quantity >= d.minQuantity)
    .sort((a, b) => b.minQuantity - a.minQuantity)[0];

  if (!applicableDiscount) {
    return { unitPrice: basePrice, discount: 0, appliedDiscount: null };
  }

  let discount = 0;
  if (applicableDiscount.discountType === 'percent') {
    discount = Math.floor(basePrice * (applicableDiscount.discountValue / 100));
  } else {
    discount = applicableDiscount.discountValue;
  }

  const unitPrice = basePrice - discount;
  return { unitPrice, discount, appliedDiscount: applicableDiscount };
}

// 타임세일 할인 계산
export function calculateTimeSaleDiscount(
  basePrice: number,
  timeSale: TimeSale | null
): { salePrice: number; discount: number; remainingTime: number } {
  if (!timeSale) {
    return { salePrice: basePrice, discount: 0, remainingTime: 0 };
  }

  let discount = 0;
  if (timeSale.discountType === 'percent') {
    discount = Math.floor(basePrice * (timeSale.discountValue / 100));
  } else {
    discount = timeSale.discountValue;
  }

  const salePrice = basePrice - discount;
  const remainingTime = new Date(timeSale.endsAt).getTime() - Date.now();

  return { salePrice, discount, remainingTime };
}

// 남은 시간 포맷팅
export function formatRemainingTime(ms: number): string {
  if (ms <= 0) return '종료됨';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}일 ${hours % 24}시간`;
  }

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }

  return `${minutes}분 ${seconds}초`;
}

// 최종 가격 계산 (타임세일 + 수량할인 조합)
export function calculateFinalPrice(
  basePrice: number,
  quantity: number,
  timeSale: TimeSale | null,
  quantityDiscounts: QuantityDiscount[]
): {
  unitPrice: number;
  totalPrice: number;
  timeSaleDiscount: number;
  quantityDiscount: number;
  appliedTimeSale: TimeSale | null;
  appliedQuantityDiscount: QuantityDiscount | null;
} {
  // 1. 타임세일 적용
  const timeSaleResult = calculateTimeSaleDiscount(basePrice, timeSale);
  const priceAfterTimeSale = timeSaleResult.salePrice;

  // 2. 수량별 할인 적용 (타임세일 적용 후 가격에)
  const quantityResult = calculateQuantityDiscount(priceAfterTimeSale, quantity, quantityDiscounts);

  return {
    unitPrice: quantityResult.unitPrice,
    totalPrice: quantityResult.unitPrice * quantity,
    timeSaleDiscount: timeSaleResult.discount,
    quantityDiscount: quantityResult.discount,
    appliedTimeSale: timeSale,
    appliedQuantityDiscount: quantityResult.appliedDiscount,
  };
}
