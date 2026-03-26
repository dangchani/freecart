import { createClient } from '@/lib/supabase/client';

export interface StockAlert {
  id: string;
  productId: string;
  variantId: string | null;
  email: string;
  phone: string | null;
  createdAt: string;
}

// 재고 알림 신청
export async function requestStockAlert(
  productId: string,
  email: string,
  variantId?: string,
  phone?: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createClient();

  // 이미 신청했는지 확인
  let query = supabase
    .from('product_stock_alerts')
    .select('id')
    .eq('product_id', productId)
    .eq('email', email);

  if (variantId) {
    query = query.eq('variant_id', variantId);
  } else {
    query = query.is('variant_id', null);
  }

  const { data: existing } = await query.maybeSingle();

  if (existing) {
    return { success: false, message: '이미 재고 알림을 신청하셨습니다.' };
  }

  const { error } = await supabase.from('product_stock_alerts').insert({
    product_id: productId,
    variant_id: variantId || null,
    email,
    phone: phone || null,
    is_notified: false,
  });

  if (error) {
    console.error('Failed to request stock alert:', error);
    return { success: false, message: '재고 알림 신청에 실패했습니다.' };
  }

  return { success: true, message: '재고 알림이 신청되었습니다. 재입고 시 이메일로 안내드리겠습니다.' };
}

// 내 재고 알림 신청 목록
export async function getMyStockAlerts(email: string): Promise<StockAlert[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from('product_stock_alerts')
    .select('id, product_id, variant_id, email, phone, created_at')
    .eq('email', email)
    .eq('is_notified', false)
    .order('created_at', { ascending: false });

  return (data || []).map((a: any) => ({
    id: a.id,
    productId: a.product_id,
    variantId: a.variant_id,
    email: a.email,
    phone: a.phone,
    createdAt: a.created_at,
  }));
}

// 재고 알림 취소
export async function cancelStockAlert(alertId: string): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('product_stock_alerts')
    .delete()
    .eq('id', alertId);

  return !error;
}
