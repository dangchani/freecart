import { createClient } from '@/lib/supabase/client';

export type CashReceiptType = 'income' | 'expense';
export type IdentityType = 'phone' | 'business' | 'card';
export type CashReceiptStatus = 'pending' | 'issued' | 'cancelled';

export interface CashReceipt {
  id: string;
  paymentId: string;
  orderId: string;
  orderNumber: string;
  type: CashReceiptType;
  identityType: IdentityType;
  identityNumber: string;
  amount: number;
  approvalNumber: string | null;
  issuedAt: string | null;
  status: CashReceiptStatus;
  createdAt: string;
}

export interface CreateCashReceiptInput {
  orderId: string;
  type: CashReceiptType;
  identityType: IdentityType;
  identityNumber: string;
}

/** 현금영수증 발급 요청 */
export async function createCashReceipt(input: CreateCashReceiptInput): Promise<CashReceipt> {
  const supabase = createClient();

  // 주문에서 payment_id 조회
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, order_number, total_amount')
    .eq('id', input.orderId)
    .single();

  if (orderErr || !order) throw new Error('주문을 찾을 수 없습니다.');

  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .select('id, amount')
    .eq('order_id', input.orderId)
    .eq('status', 'completed')
    .single();

  if (payErr || !payment) throw new Error('결제 정보를 찾을 수 없습니다.');

  // 이미 발급된 현금영수증 확인
  const { data: existing } = await supabase
    .from('cash_receipts')
    .select('id')
    .eq('payment_id', payment.id)
    .neq('status', 'cancelled')
    .single();

  if (existing) throw new Error('이미 현금영수증이 발급되었습니다.');

  const { data, error } = await supabase
    .from('cash_receipts')
    .insert({
      payment_id: payment.id,
      type: input.type,
      identity_type: input.identityType,
      identity_number: input.identityNumber,
      amount: payment.amount,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;

  return mapCashReceipt(data, input.orderId, order.order_number);
}

/** 현금영수증 목록 조회 */
export async function getCashReceipts(userId: string): Promise<CashReceipt[]> {
  const supabase = createClient();

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number')
    .eq('user_id', userId);

  if (!orders || orders.length === 0) return [];

  const orderMap = new Map(orders.map((o: any) => [o.id, o.order_number]));
  const orderIds = orders.map((o: any) => o.id);

  const { data: payments } = await supabase
    .from('payments')
    .select('id, order_id')
    .in('order_id', orderIds);

  if (!payments || payments.length === 0) return [];

  const paymentOrderMap = new Map(payments.map((p: any) => [p.id, p.order_id]));
  const paymentIds = payments.map((p: any) => p.id);

  const { data: receipts, error } = await supabase
    .from('cash_receipts')
    .select('*')
    .in('payment_id', paymentIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (receipts || []).map((r: any) => {
    const orderId = paymentOrderMap.get(r.payment_id) || '';
    const orderNumber = orderMap.get(orderId) || '';
    return mapCashReceipt(r, orderId, orderNumber);
  });
}

/** 주문별 현금영수증 조회 */
export async function getCashReceiptByOrder(orderId: string): Promise<CashReceipt | null> {
  const supabase = createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number')
    .eq('id', orderId)
    .single();

  if (!order) return null;

  const { data: payment } = await supabase
    .from('payments')
    .select('id')
    .eq('order_id', orderId)
    .single();

  if (!payment) return null;

  const { data: receipt } = await supabase
    .from('cash_receipts')
    .select('*')
    .eq('payment_id', payment.id)
    .neq('status', 'cancelled')
    .single();

  if (!receipt) return null;

  return mapCashReceipt(receipt, orderId, order.order_number);
}

function mapCashReceipt(row: any, orderId: string, orderNumber: string): CashReceipt {
  return {
    id: row.id,
    paymentId: row.payment_id,
    orderId,
    orderNumber,
    type: row.type,
    identityType: row.identity_type,
    identityNumber: row.identity_number,
    amount: row.amount,
    approvalNumber: row.approval_number,
    issuedAt: row.issued_at,
    status: row.status,
    createdAt: row.created_at,
  };
}
