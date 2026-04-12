import { createClient } from '@/lib/supabase/client';

export interface PointsHistory {
  id: string;
  amount: number;
  balance: number;
  type: string;
  description: string;
  createdAt: string;
}

/**
 * 사용자 포인트 잔액 조회
 */
export async function getUserPoints(userId: string): Promise<number> {
  const supabase = createClient();

  const { data } = await supabase
    .from('users')
    .select('points')
    .eq('id', userId)
    .maybeSingle();

  return data?.points || 0;
}

/**
 * 포인트 내역 조회
 */
export async function getPointsHistory(userId: string, limit = 20): Promise<PointsHistory[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('user_points_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((item: any) => ({
    id: item.id,
    amount: item.amount,
    balance: item.balance,
    type: item.type,
    description: item.description,
    createdAt: item.created_at,
  }));
}

/**
 * 포인트 사용 가능 여부 확인
 * - 100원 단위로만 사용 가능
 * - 최소 1000포인트 이상 보유 시 사용 가능
 */
export function validatePointsUsage(
  currentPoints: number,
  useAmount: number,
  orderAmount: number,
  config?: { minThreshold?: number; unitAmount?: number; maxUsagePercent?: number }
): { valid: boolean; message?: string } {
  const minThreshold = config?.minThreshold ?? 1000;
  const unitAmount = config?.unitAmount ?? 100;
  const maxUsagePercent = (config?.maxUsagePercent ?? 50) / 100;

  if (useAmount <= 0) {
    return { valid: true };
  }

  if (currentPoints < minThreshold) {
    return { valid: false, message: `${minThreshold.toLocaleString()}포인트 이상 보유 시 사용 가능합니다.` };
  }

  if (useAmount > currentPoints) {
    return { valid: false, message: '보유 포인트를 초과하여 사용할 수 없습니다.' };
  }

  if (unitAmount > 0 && useAmount % unitAmount !== 0) {
    return { valid: false, message: `포인트는 ${unitAmount.toLocaleString()}원 단위로 사용 가능합니다.` };
  }

  const maxPointsUsage = Math.floor(orderAmount * maxUsagePercent);
  if (useAmount > maxPointsUsage) {
    return {
      valid: false,
      message: `최대 ${maxPointsUsage.toLocaleString()}포인트까지 사용 가능합니다. (결제금액의 ${Math.round(maxUsagePercent * 100)}%)`
    };
  }

  return { valid: true };
}

/**
 * 포인트 사용 (주문 완료 시 호출)
 */
export async function usePoints(
  userId: string,
  amount: number,
  orderId: string,
  description: string
): Promise<void> {
  const supabase = createClient();

  // 현재 포인트 조회
  const currentPoints = await getUserPoints(userId);

  if (currentPoints < amount) {
    throw new Error('포인트가 부족합니다.');
  }

  const newBalance = currentPoints - amount;

  // 포인트 차감
  const { error: updateError } = await supabase
    .from('users')
    .update({ points: newBalance })
    .eq('id', userId);

  if (updateError) throw updateError;

  // 포인트 내역 기록
  const { error: historyError } = await supabase
    .from('user_points_history')
    .insert({
      user_id: userId,
      amount: -amount,
      balance: newBalance,
      type: 'use',
      description,
      reference_type: 'order',
      reference_id: orderId,
    });

  if (historyError) throw historyError;
}

/**
 * 포인트 복구 (취소/환불 시 호출)
 */
export async function restorePoints(
  userId: string,
  amount: number,
  orderId: string
): Promise<void> {
  if (amount <= 0) return;
  const supabase = createClient();

  const currentPoints = await getUserPoints(userId);
  const newBalance = currentPoints + amount;

  const { error: updateError } = await supabase
    .from('users')
    .update({ points: newBalance })
    .eq('id', userId);

  if (updateError) throw updateError;

  const { error: historyError } = await supabase
    .from('user_points_history')
    .insert({
      user_id: userId,
      amount,
      balance: newBalance,
      type: 'restore',
      description: `주문 취소/환불 포인트 복구`,
      reference_type: 'order',
      reference_id: orderId,
    });

  if (historyError) throw historyError;
}

/**
 * 구매확정 포인트 적립 (transitionOrderStatus 'confirmed' 시 호출)
 * - 이미 적립된 이력이 있으면 중복 지급하지 않음
 */
export async function awardOrderPoints(
  orderId: string,
  changedBy?: string,
): Promise<void> {
  const supabase = createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('user_id, earned_points, status')
    .eq('id', orderId)
    .single();

  if (!order || order.status !== 'confirmed') return;
  if (!order.user_id || (order.earned_points ?? 0) <= 0) return;

  // 중복 지급 방지
  const { data: existing } = await supabase
    .from('user_points_history')
    .select('id')
    .eq('reference_type', 'order')
    .eq('reference_id', orderId)
    .eq('type', 'earn')
    .maybeSingle();

  if (existing) return;

  await earnPoints(
    order.user_id,
    order.earned_points,
    'order',
    orderId,
    '구매확정 포인트 적립',
  );
}

/**
 * 포인트 적립 (주문 완료/리뷰 작성 시 호출)
 */
export async function earnPoints(
  userId: string,
  amount: number,
  referenceType: string,
  referenceId: string,
  description: string,
  expiresAt?: string
): Promise<void> {
  const supabase = createClient();

  // 현재 포인트 조회
  const currentPoints = await getUserPoints(userId);
  const newBalance = currentPoints + amount;

  // 포인트 적립
  const { error: updateError } = await supabase
    .from('users')
    .update({ points: newBalance })
    .eq('id', userId);

  if (updateError) throw updateError;

  // 포인트 내역 기록
  const { error: historyError } = await supabase
    .from('user_points_history')
    .insert({
      user_id: userId,
      amount,
      balance: newBalance,
      type: 'earn',
      description,
      reference_type: referenceType,
      reference_id: referenceId,
      expires_at: expiresAt,
    });

  if (historyError) throw historyError;
}
