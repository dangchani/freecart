import { createClient } from '@/lib/supabase/client';

export type TaxInvoiceStatus = 'pending' | 'issued' | 'cancelled';
export type IssueType = 'regular' | 'reverse';

export interface TaxInvoice {
  id: string;
  paymentId: string;
  orderId: string;
  orderNumber: string;
  businessNumber: string;
  companyName: string;
  ceoName: string;
  businessAddress: string;
  businessType: string | null;
  businessCategory: string | null;
  email: string;
  amount: number;
  vat: number;
  totalAmount: number;
  issueType: IssueType;
  approvalNumber: string | null;
  issuedAt: string | null;
  status: TaxInvoiceStatus;
  createdAt: string;
}

export interface CreateTaxInvoiceInput {
  orderId: string;
  businessNumber: string;
  companyName: string;
  ceoName: string;
  businessAddress: string;
  businessType?: string;
  businessCategory?: string;
  email: string;
}

/** 세금계산서 발급 요청 */
export async function createTaxInvoice(input: CreateTaxInvoiceInput): Promise<TaxInvoice> {
  const supabase = createClient();

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

  // 이미 발급된 세금계산서 확인
  const { data: existing } = await supabase
    .from('tax_invoices')
    .select('id')
    .eq('payment_id', payment.id)
    .neq('status', 'cancelled')
    .single();

  if (existing) throw new Error('이미 세금계산서가 발급되었습니다.');

  const totalAmount = payment.amount;
  const vat = Math.round(totalAmount / 11);
  const supplyAmount = totalAmount - vat;

  const { data, error } = await supabase
    .from('tax_invoices')
    .insert({
      payment_id: payment.id,
      business_number: input.businessNumber,
      company_name: input.companyName,
      ceo_name: input.ceoName,
      business_address: input.businessAddress,
      business_type: input.businessType || null,
      business_category: input.businessCategory || null,
      email: input.email,
      amount: supplyAmount,
      vat,
      total_amount: totalAmount,
      issue_type: 'regular',
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;

  return mapTaxInvoice(data, input.orderId, order.order_number);
}

/** 세금계산서 목록 조회 */
export async function getTaxInvoices(userId: string): Promise<TaxInvoice[]> {
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

  const { data: invoices, error } = await supabase
    .from('tax_invoices')
    .select('*')
    .in('payment_id', paymentIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (invoices || []).map((r: any) => {
    const orderId = paymentOrderMap.get(r.payment_id) || '';
    const orderNumber = orderMap.get(orderId) || '';
    return mapTaxInvoice(r, orderId, orderNumber);
  });
}

/** 반품 후 세금계산서 재발급 요청 */
export async function reissueTaxInvoice(
  originalInvoiceId: string,
  newAmount: number,
): Promise<{ success: boolean; error?: string; invoiceId?: string }> {
  const supabase = createClient();

  const { data: original, error: fetchErr } = await supabase
    .from('tax_invoices')
    .select('*')
    .eq('id', originalInvoiceId)
    .single();

  if (fetchErr || !original) return { success: false, error: '원본 세금계산서를 찾을 수 없습니다.' };

  const vat          = Math.round(newAmount / 11);
  const supplyAmount = newAmount - vat;

  const { data: inserted, error: insertErr } = await supabase
    .from('tax_invoices')
    .insert({
      payment_id:          (original as any).payment_id,
      business_number:     (original as any).business_number,
      company_name:        (original as any).company_name,
      ceo_name:            (original as any).ceo_name,
      business_address:    (original as any).business_address,
      business_type:       (original as any).business_type   ?? null,
      business_category:   (original as any).business_category ?? null,
      email:               (original as any).email,
      amount:              supplyAmount,
      vat,
      total_amount:        newAmount,
      issue_type:          'regular',
      status:              'pending',
      original_invoice_id: originalInvoiceId,
    })
    .select('id')
    .single();

  if (insertErr || !inserted) return { success: false, error: '재발급 요청에 실패했습니다.' };

  return { success: true, invoiceId: (inserted as any).id as string };
}

function mapTaxInvoice(row: any, orderId: string, orderNumber: string): TaxInvoice {
  return {
    id: row.id,
    paymentId: row.payment_id,
    orderId,
    orderNumber,
    businessNumber: row.business_number,
    companyName: row.company_name,
    ceoName: row.ceo_name,
    businessAddress: row.business_address,
    businessType: row.business_type,
    businessCategory: row.business_category,
    email: row.email,
    amount: row.amount,
    vat: row.vat,
    totalAmount: row.total_amount,
    issueType: row.issue_type,
    approvalNumber: row.approval_number,
    issuedAt: row.issued_at,
    status: row.status,
    createdAt: row.created_at,
  };
}
