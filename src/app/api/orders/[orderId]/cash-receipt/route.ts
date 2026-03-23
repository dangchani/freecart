import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const cashReceiptSchema = z.object({
  type: z.enum(['income_deduction', 'expense_proof'], {
    errorMap: () => ({ message: '현금영수증 유형이 올바르지 않습니다.' }),
  }),
  identifierType: z.enum(['phone', 'business_number'], {
    errorMap: () => ({ message: '식별번호 유형이 올바르지 않습니다.' }),
  }),
  identifier: z.string().min(1, '식별번호를 입력해 주세요.'),
});

function maskIdentifier(identifier: string, identifierType: 'phone' | 'business_number'): string {
  const clean = identifier.replace(/[^0-9]/g, '');
  if (identifierType === 'phone') {
    // 010-****-5678 format
    if (clean.length >= 10) {
      return `${clean.slice(0, 3)}-****-${clean.slice(-4)}`;
    }
    return clean.slice(0, 3) + '****' + clean.slice(-2);
  } else {
    // 123-**-67890
    if (clean.length >= 10) {
      return `${clean.slice(0, 3)}-**-${clean.slice(-5)}`;
    }
    return clean.slice(0, 3) + '**' + clean.slice(-3);
  }
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
    const { type, identifierType, identifier } = cashReceiptSchema.parse(body);

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
        { success: false, error: '결제 완료된 주문만 현금영수증 신청이 가능합니다.' },
        { status: 400 }
      );
    }

    // Check if a cash receipt already exists
    const { data: existing } = await supabase
      .from('cash_receipts')
      .select('id')
      .eq('order_id', order.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 현금영수증이 발급된 주문입니다.' },
        { status: 400 }
      );
    }

    // Generate a mock approval number
    const approvalNumber = `CR${Date.now()}`;

    const { data: cashReceipt, error: insertError } = await supabase
      .from('cash_receipts')
      .insert({
        order_id: order.id,
        user_id: user.id,
        type,
        identifier_type: identifierType,
        identifier,
        amount: order.total,
        approval_number: approvalNumber,
        status: 'issued',
        issued_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { success: false, error: '현금영수증 발급 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    const maskedIdentifier = maskIdentifier(identifier, identifierType);

    return NextResponse.json(
      {
        success: true,
        data: {
          ...cashReceipt,
          identifier: maskedIdentifier,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message ?? '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    console.error('POST /orders/[orderId]/cash-receipt error:', error);
    return NextResponse.json(
      { success: false, error: '현금영수증 발급 중 오류가 발생했습니다.' },
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

    const { data: cashReceipt, error: fetchError } = await supabase
      .from('cash_receipts')
      .select('*')
      .eq('order_id', order.id)
      .single();

    if (fetchError || !cashReceipt) {
      return NextResponse.json(
        { success: false, error: '현금영수증을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Mask identifier before returning
    const maskedIdentifier = maskIdentifier(
      cashReceipt.identifier,
      cashReceipt.identifier_type as 'phone' | 'business_number'
    );

    return NextResponse.json({
      success: true,
      data: {
        ...cashReceipt,
        identifier: maskedIdentifier,
      },
    });
  } catch (error) {
    console.error('GET /orders/[orderId]/cash-receipt error:', error);
    return NextResponse.json(
      { success: false, error: '현금영수증 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
