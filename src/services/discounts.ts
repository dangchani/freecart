import { createClient } from '@/lib/supabase/client';

// =============================================================================
// Types
// =============================================================================

export interface QuantityDiscount {
  id: string;
  productId: string;
  minQuantity: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  isActive: boolean;
  sortOrder: number;
}

export interface QuantityDiscountDraft {
  localId: string;
  dbId: string | null;
  minQuantity: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  isActive: boolean;
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

// =============================================================================
// Read
// =============================================================================

/** 사용자용 — 활성 수량 할인만 조회 */
export async function getQuantityDiscounts(productId: string): Promise<QuantityDiscount[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('product_quantity_discounts')
    .select('id, product_id, min_quantity, discount_type, discount_value, is_active, sort_order')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('min_quantity', { ascending: true });

  return (data || []).map(mapDiscount);
}

/** 관리자용 — 비활성 포함 전체 조회 */
export async function getQuantityDiscountsAdmin(productId: string): Promise<QuantityDiscount[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('product_quantity_discounts')
    .select('id, product_id, min_quantity, discount_type, discount_value, is_active, sort_order')
    .eq('product_id', productId)
    .order('min_quantity', { ascending: true });

  return (data || []).map(mapDiscount);
}

function mapDiscount(d: any): QuantityDiscount {
  return {
    id: d.id,
    productId: d.product_id,
    minQuantity: d.min_quantity,
    discountType: d.discount_type,
    discountValue: d.discount_value,
    isActive: d.is_active,
    sortOrder: d.sort_order,
  };
}

// =============================================================================
// Write (관리자)
// =============================================================================

/** 수량 할인 전체 저장 (기존 삭제 후 재삽입) */
export async function saveQuantityDiscounts(
  productId: string,
  drafts: QuantityDiscountDraft[]
): Promise<void> {
  const supabase = createClient();

  await supabase
    .from('product_quantity_discounts')
    .delete()
    .eq('product_id', productId);

  if (drafts.length === 0) return;

  const inserts = drafts.map((d, i) => ({
    product_id: productId,
    min_quantity: d.minQuantity,
    discount_type: d.discountType,
    discount_value: d.discountValue,
    is_active: d.isActive,
    sort_order: i,
  }));

  const { error } = await supabase
    .from('product_quantity_discounts')
    .insert(inserts);

  if (error) throw error;
}

// =============================================================================
// 계산 유틸
// =============================================================================

/** 현재 수량에 적용되는 할인 구간 반환 */
export function getApplicableDiscount(
  quantity: number,
  discounts: QuantityDiscount[]
): QuantityDiscount | null {
  return (
    discounts
      .filter((d) => d.isActive && quantity >= d.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity)[0] ?? null
  );
}

/** 수량별 할인 계산 */
export function calculateQuantityDiscount(
  basePrice: number,
  quantity: number,
  discounts: QuantityDiscount[]
): { unitPrice: number; discountAmount: number; appliedDiscount: QuantityDiscount | null } {
  const applicable = getApplicableDiscount(quantity, discounts);

  if (!applicable) {
    return { unitPrice: basePrice, discountAmount: 0, appliedDiscount: null };
  }

  const discountAmount =
    applicable.discountType === 'percent'
      ? Math.floor(basePrice * (applicable.discountValue / 100))
      : applicable.discountValue;

  return {
    unitPrice: Math.max(0, basePrice - discountAmount),
    discountAmount,
    appliedDiscount: applicable,
  };
}

// =============================================================================
// 타임세일
// =============================================================================

/** 상품의 현재 활성 타임세일 조회 */
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

/** 타임세일 할인 계산 */
export function calculateTimeSaleDiscount(
  basePrice: number,
  timeSale: TimeSale | null
): { salePrice: number; discount: number; remainingTime: number } {
  if (!timeSale) {
    return { salePrice: basePrice, discount: 0, remainingTime: 0 };
  }

  const discount =
    timeSale.discountType === 'percent'
      ? Math.floor(basePrice * (timeSale.discountValue / 100))
      : timeSale.discountValue;

  return {
    salePrice: Math.max(0, basePrice - discount),
    discount,
    remainingTime: new Date(timeSale.endsAt).getTime() - Date.now(),
  };
}

/** 최종 가격 계산 (타임세일 → 수량할인 순 적용) */
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
  const timeSaleResult = calculateTimeSaleDiscount(basePrice, timeSale);
  const quantityResult = calculateQuantityDiscount(timeSaleResult.salePrice, quantity, quantityDiscounts);

  return {
    unitPrice: quantityResult.unitPrice,
    totalPrice: quantityResult.unitPrice * quantity,
    timeSaleDiscount: timeSaleResult.discount,
    quantityDiscount: quantityResult.discountAmount,
    appliedTimeSale: timeSale,
    appliedQuantityDiscount: quantityResult.appliedDiscount,
  };
}

// =============================================================================
// 포맷 유틸
// =============================================================================

export function formatRemainingTime(ms: number): string {
  if (ms <= 0) return '종료됨';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  if (hours > 24) return `${Math.floor(hours / 24)}일 ${hours % 24}시간`;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분 ${seconds}초`;
}

export function formatDiscountLabel(discount: QuantityDiscount): string {
  return discount.discountType === 'percent'
    ? `${discount.discountValue}%`
    : `${discount.discountValue.toLocaleString()}원`;
}
