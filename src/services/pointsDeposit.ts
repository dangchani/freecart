import { createClient } from '@/lib/supabase/client';

export type PointType = 'earn' | 'use' | 'expire' | 'cancel' | 'admin';
export type DepositType = 'charge' | 'use' | 'refund' | 'admin';

export interface PointHistory {
  id: string;
  type: PointType;
  amount: number;
  balance: number;
  description: string;
  orderId?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface DepositHistory {
  id: string;
  type: DepositType;
  amount: number;
  balance: number;
  description: string;
  orderId?: string;
  createdAt: string;
}

export interface PointBalance {
  total: number;
  available: number;
  expiringSoon: number; // 30일 내 만료 예정
  expiringThisMonth: number;
}

// 포인트 잔액 조회
export async function getPointBalance(userId: string): Promise<PointBalance> {
  const supabase = createClient();

  const { data: user } = await supabase
    .from('users')
    .select('points')
    .eq('id', userId)
    .single();

  const total = user?.points || 0;

  // 30일 내 만료 예정 포인트 조회
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

  const { data: expiring } = await supabase
    .from('point_history')
    .select('amount, expires_at')
    .eq('user_id', userId)
    .eq('type', 'earn')
    .lte('expires_at', thirtyDaysLater.toISOString())
    .gt('expires_at', new Date().toISOString());

  const expiringSoon = (expiring || []).reduce((sum: number, p: any) => sum + p.amount, 0);

  // 이번 달 만료 예정
  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0);

  const { data: expiringMonth } = await supabase
    .from('point_history')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'earn')
    .lte('expires_at', endOfMonth.toISOString())
    .gt('expires_at', new Date().toISOString());

  const expiringThisMonth = (expiringMonth || []).reduce((sum: number, p: any) => sum + p.amount, 0);

  return {
    total,
    available: total,
    expiringSoon,
    expiringThisMonth,
  };
}

// 포인트 내역 조회
export async function getPointHistory(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ history: PointHistory[]; total: number }> {
  const supabase = createClient();

  const { data, error, count } = await supabase
    .from('point_history')
    .select('id, type, amount, balance, description, order_id, expires_at, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) return { history: [], total: 0 };

  return {
    history: data.map((p: any) => ({
      id: p.id,
      type: p.type,
      amount: p.amount,
      balance: p.balance,
      description: p.description,
      orderId: p.order_id,
      expiresAt: p.expires_at,
      createdAt: p.created_at,
    })),
    total: count || 0,
  };
}

// 포인트 적립
export async function earnPoints(
  userId: string,
  amount: number,
  description: string,
  orderId?: string,
  expiresInDays: number = 365
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // 현재 잔액 조회
  const { data: user } = await supabase
    .from('users')
    .select('points')
    .eq('id', userId)
    .single();

  const currentBalance = user?.points || 0;
  const newBalance = currentBalance + amount;

  // 만료일 계산
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  // 트랜잭션 처리
  const { error: historyError } = await supabase.from('point_history').insert({
    user_id: userId,
    type: 'earn',
    amount,
    balance: newBalance,
    description,
    order_id: orderId,
    expires_at: expiresAt.toISOString(),
  });

  if (historyError) {
    return { success: false, error: '포인트 적립에 실패했습니다.' };
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ points: newBalance })
    .eq('id', userId);

  if (updateError) {
    return { success: false, error: '포인트 업데이트에 실패했습니다.' };
  }

  return { success: true };
}

// 포인트 사용
export async function usePoints(
  userId: string,
  amount: number,
  description: string,
  orderId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // 현재 잔액 확인
  const { data: user } = await supabase
    .from('users')
    .select('points')
    .eq('id', userId)
    .single();

  const currentBalance = user?.points || 0;

  if (currentBalance < amount) {
    return { success: false, error: '포인트가 부족합니다.' };
  }

  const newBalance = currentBalance - amount;

  // 포인트 사용 기록
  const { error: historyError } = await supabase.from('point_history').insert({
    user_id: userId,
    type: 'use',
    amount: -amount,
    balance: newBalance,
    description,
    order_id: orderId,
  });

  if (historyError) {
    return { success: false, error: '포인트 사용에 실패했습니다.' };
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ points: newBalance })
    .eq('id', userId);

  if (updateError) {
    return { success: false, error: '포인트 업데이트에 실패했습니다.' };
  }

  return { success: true };
}

// 포인트 사용 취소 (환불 시)
export async function cancelPointUse(
  userId: string,
  amount: number,
  description: string,
  orderId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { data: user } = await supabase
    .from('users')
    .select('points')
    .eq('id', userId)
    .single();

  const newBalance = (user?.points || 0) + amount;

  const { error: historyError } = await supabase.from('point_history').insert({
    user_id: userId,
    type: 'cancel',
    amount,
    balance: newBalance,
    description,
    order_id: orderId,
  });

  if (historyError) {
    return { success: false, error: '포인트 취소에 실패했습니다.' };
  }

  await supabase.from('users').update({ points: newBalance }).eq('id', userId);

  return { success: true };
}

// 예치금 잔액 조회
export async function getDepositBalance(userId: string): Promise<number> {
  const supabase = createClient();

  const { data } = await supabase
    .from('users')
    .select('deposit')
    .eq('id', userId)
    .single();

  return data?.deposit || 0;
}

// 예치금 내역 조회
export async function getDepositHistory(
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ history: DepositHistory[]; total: number }> {
  const supabase = createClient();

  const { data, error, count } = await supabase
    .from('deposit_history')
    .select('id, type, amount, balance, description, order_id, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) return { history: [], total: 0 };

  return {
    history: data.map((d: any) => ({
      id: d.id,
      type: d.type,
      amount: d.amount,
      balance: d.balance,
      description: d.description,
      orderId: d.order_id,
      createdAt: d.created_at,
    })),
    total: count || 0,
  };
}

// 예치금 충전
export async function chargeDeposit(
  userId: string,
  amount: number,
  description: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { data: user } = await supabase
    .from('users')
    .select('deposit')
    .eq('id', userId)
    .single();

  const newBalance = (user?.deposit || 0) + amount;

  const { error: historyError } = await supabase.from('deposit_history').insert({
    user_id: userId,
    type: 'charge',
    amount,
    balance: newBalance,
    description,
  });

  if (historyError) {
    return { success: false, error: '예치금 충전에 실패했습니다.' };
  }

  await supabase.from('users').update({ deposit: newBalance }).eq('id', userId);

  return { success: true };
}

// 예치금 사용
export async function useDeposit(
  userId: string,
  amount: number,
  description: string,
  orderId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { data: user } = await supabase
    .from('users')
    .select('deposit')
    .eq('id', userId)
    .single();

  const currentBalance = user?.deposit || 0;

  if (currentBalance < amount) {
    return { success: false, error: '예치금이 부족합니다.' };
  }

  const newBalance = currentBalance - amount;

  const { error: historyError } = await supabase.from('deposit_history').insert({
    user_id: userId,
    type: 'use',
    amount: -amount,
    balance: newBalance,
    description,
    order_id: orderId,
  });

  if (historyError) {
    return { success: false, error: '예치금 사용에 실패했습니다.' };
  }

  await supabase.from('users').update({ deposit: newBalance }).eq('id', userId);

  return { success: true };
}

// 예치금 환불
export async function refundDeposit(
  userId: string,
  amount: number,
  description: string,
  orderId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { data: user } = await supabase
    .from('users')
    .select('deposit')
    .eq('id', userId)
    .single();

  const newBalance = (user?.deposit || 0) + amount;

  const { error: historyError } = await supabase.from('deposit_history').insert({
    user_id: userId,
    type: 'refund',
    amount,
    balance: newBalance,
    description,
    order_id: orderId,
  });

  if (historyError) {
    return { success: false, error: '예치금 환불에 실패했습니다.' };
  }

  await supabase.from('users').update({ deposit: newBalance }).eq('id', userId);

  return { success: true };
}

// 만료된 포인트 처리 (스케줄러에서 호출)
export async function processExpiredPoints(): Promise<number> {
  const supabase = createClient();

  // 만료된 적립 포인트 조회
  const { data: expiredPoints } = await supabase
    .from('point_history')
    .select('id, user_id, amount')
    .eq('type', 'earn')
    .eq('is_expired', false)
    .lte('expires_at', new Date().toISOString());

  if (!expiredPoints || expiredPoints.length === 0) return 0;

  let processedCount = 0;

  for (const point of expiredPoints) {
    // 사용자별로 만료 처리
    const { data: user } = await supabase
      .from('users')
      .select('points')
      .eq('id', point.user_id)
      .single();

    const newBalance = Math.max(0, (user?.points || 0) - point.amount);

    await supabase.from('point_history').insert({
      user_id: point.user_id,
      type: 'expire',
      amount: -point.amount,
      balance: newBalance,
      description: '포인트 유효기간 만료',
    });

    await supabase
      .from('point_history')
      .update({ is_expired: true })
      .eq('id', point.id);

    await supabase
      .from('users')
      .update({ points: newBalance })
      .eq('id', point.user_id);

    processedCount++;
  }

  return processedCount;
}
