import { createClient } from '@/lib/supabase/client';

export interface UserLevel {
  id: string;
  level: number;
  name: string;
  discountRate: number;
  pointRate: number;
}

export interface ProductLevelPrice {
  productId: string;
  levelId: string;
  price: number;
}

// 사용자의 회원 등급 정보 조회
export async function getUserLevel(userId: string): Promise<UserLevel | null> {
  const supabase = createClient();

  const { data: user } = await supabase
    .from('users')
    .select('level_id')
    .eq('id', userId)
    .single();

  if (!user?.level_id) {
    // 기본 등급 반환
    const { data: defaultLevel } = await supabase
      .from('user_levels')
      .select('id, level, name, discount_rate, point_rate')
      .eq('level', 1)
      .single();

    if (defaultLevel) {
      return {
        id: defaultLevel.id,
        level: defaultLevel.level,
        name: defaultLevel.name,
        discountRate: Number(defaultLevel.discount_rate),
        pointRate: Number(defaultLevel.point_rate),
      };
    }
    return null;
  }

  const { data: level } = await supabase
    .from('user_levels')
    .select('id, level, name, discount_rate, point_rate')
    .eq('id', user.level_id)
    .single();

  if (!level) return null;

  return {
    id: level.id,
    level: level.level,
    name: level.name,
    discountRate: Number(level.discount_rate),
    pointRate: Number(level.point_rate),
  };
}

// 상품의 등급별 특별 가격 조회
export async function getProductLevelPrices(productId: string): Promise<ProductLevelPrice[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from('product_level_prices')
    .select('product_id, level_id, price')
    .eq('product_id', productId);

  return (data || []).map((p: any) => ({
    productId: p.product_id,
    levelId: p.level_id,
    price: p.price,
  }));
}

// 사용자 등급에 따른 상품 가격 계산
export function calculateLevelPrice(
  basePrice: number,
  userLevel: UserLevel | null,
  levelPrices: ProductLevelPrice[]
): { finalPrice: number; discountRate: number; discountType: 'level_price' | 'level_discount' | 'none' } {
  if (!userLevel) {
    return { finalPrice: basePrice, discountRate: 0, discountType: 'none' };
  }

  // 1. 먼저 상품별 등급 가격이 있는지 확인
  const levelPrice = levelPrices.find((p) => p.levelId === userLevel.id);
  if (levelPrice && levelPrice.price < basePrice) {
    const discountRate = Math.round(((basePrice - levelPrice.price) / basePrice) * 100);
    return { finalPrice: levelPrice.price, discountRate, discountType: 'level_price' };
  }

  // 2. 등급별 할인율 적용
  if (userLevel.discountRate > 0) {
    const discount = Math.floor(basePrice * (userLevel.discountRate / 100));
    const finalPrice = basePrice - discount;
    return { finalPrice, discountRate: userLevel.discountRate, discountType: 'level_discount' };
  }

  return { finalPrice: basePrice, discountRate: 0, discountType: 'none' };
}

// 모든 등급 목록 조회
export async function getAllLevels(): Promise<UserLevel[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from('user_levels')
    .select('id, level, name, discount_rate, point_rate')
    .order('level', { ascending: true });

  return (data || []).map((l: any) => ({
    id: l.id,
    level: l.level,
    name: l.name,
    discountRate: Number(l.discount_rate),
    pointRate: Number(l.point_rate),
  }));
}

// 사용자 등급 승격 확인 및 처리
export async function checkAndUpgradeLevel(userId: string): Promise<{ upgraded: boolean; newLevel?: UserLevel }> {
  const supabase = createClient();

  // 사용자의 총 구매 금액 계산
  const { data: orders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('user_id', userId)
    .eq('status', 'delivered');

  const totalPurchase = (orders || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);

  // 등급 조건 조회 (min_purchase 기준)
  const { data: levels } = await supabase
    .from('user_levels')
    .select('id, level, name, discount_rate, point_rate, min_purchase')
    .order('level', { ascending: false });

  if (!levels || levels.length === 0) {
    return { upgraded: false };
  }

  // 현재 사용자 등급
  const { data: user } = await supabase
    .from('users')
    .select('level_id')
    .eq('id', userId)
    .single();

  // 적합한 등급 찾기
  const eligibleLevel = levels.find((l: any) => totalPurchase >= (l.min_purchase || 0));

  if (!eligibleLevel) {
    return { upgraded: false };
  }

  // 등급이 다르면 승격
  if (user?.level_id !== eligibleLevel.id) {
    await supabase
      .from('users')
      .update({ level_id: eligibleLevel.id })
      .eq('id', userId);

    return {
      upgraded: true,
      newLevel: {
        id: eligibleLevel.id,
        level: eligibleLevel.level,
        name: eligibleLevel.name,
        discountRate: Number(eligibleLevel.discount_rate),
        pointRate: Number(eligibleLevel.point_rate),
      },
    };
  }

  return { upgraded: false };
}
