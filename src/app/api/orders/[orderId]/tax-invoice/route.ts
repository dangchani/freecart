import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const taxInvoiceSchema = z.object({
  businessNumber: z.string().min(1, '사업자등록번호를 입력해 주세요.'),
  companyName: z.string().min(1, '상호명을 입력해 주세요.'),
  ceoName: z.string().min(1, '대표자명을 입력해 주세요.'),
  businessType: z.string().min(1, '업태를 입력해 주세요.'),
  businessCategory: z.string().min(1, '종목을 입력해 주세요.'),
  email: z.string().email('유효한 이메일을 입력해 주세요.'),
  address: z.string().min(1, '사업장 주소를 입력해 주세요.'),
  recipientEmail: z.string().email('수신자 이메일을 입력해 주세요.'),
});

function generateInvoiceNumber(): string {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `${yyyymmdd}-${seq}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const invoiceData = taxInvoiceSchema.parse(body);

    // Fetch order and validate ownership and payment status
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, user_id, payment_status, total')
      .eq('id', params.orderId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (order.payment_status !== 'paid') {
      return NextResponse.json(
        { success: false, error: '결제 완료된 주문만 세금계산서 신청이 가능합니다.' },
        { status: 400 }
      );
    }

    // Check if a tax invoice already exists
    const { data: existing } = await supabase
      .from('tax_invoices')
      .select('id')
      .eq('order_id', order.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 세금계산서가 발급된 주문입니다.' },
        { status: 400 }
      );
    }

    // Calculate tax amounts (VAT = 10%)
    const totalAmount = order.total;
    // Assuming total includes VAT: amount is net, tax_amount is VAT portion
    const amount = Math.round(totalAmount / 1.1);
    const taxAmount = totalAmount - amount;
    const invoiceNumber = generateInvoiceNumber();

    const { data: taxInvoice, error: insertError } = await supabase
      .from('tax_invoices')
      .insert({
        order_id: order.id,
        user_id: user.id,
        business_number: invoiceData.businessNumber,
        company_name: invoiceData.companyName,
        ceo_name: invoiceData.ceoName,
        business_type: invoiceData.businessType,
        business_category: invoiceData.businessCategory,
        email: invoiceData.email,
        address: invoiceData.address,
        recipient_email: invoiceData.recipientEmail,
        amount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        invoice_number: invoiceNumber,
        status: 'issued',
        issued_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { success: false, error: '세금계산서 발급 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: taxInvoice }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message ?? '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    console.error('POST /orders/[orderId]/tax-invoice error:', error);
    return NextResponse.json(
      { success: false, error: '세금계산서 발급 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Verify order belongs to user
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id')
      .eq('id', params.orderId)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const { data: taxInvoice, error: fetchError } = await supabase
      .from('tax_invoices')
      .select('*')
      .eq('order_id', order.id)
      .single();

    if (fetchError || !taxInvoice) {
      return NextResponse.json(
        { success: false, error: '세금계산서를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: taxInvoice });
  } catch (error) {
    console.error('GET /orders/[orderId]/tax-invoice error:', error);
    return NextResponse.json(
      { success: false, error: '세금계산서 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
