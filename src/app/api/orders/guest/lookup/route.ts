import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const lookupSchema = z.object({
  orderNumber: z.string().min(1, '주문번호를 입력해 주세요.'),
  password: z.string().min(1, '비밀번호를 입력해 주세요.'),
});

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const body = await request.json();
    const { orderNumber, password } = lookupSchema.parse(body);

    // Fetch the order by order number (guest orders have no user_id or guest_password set)
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*)
      `)
      .eq('order_number', orderNumber)
      .is('user_id', null)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Verify password
    const hashedInput = await hashPassword(password);
    if (order.guest_password !== hashedInput) {
      return NextResponse.json(
        { success: false, error: '비밀번호가 일치하지 않습니다.' },
        { status: 401 }
      );
    }

    // Strip the guest_password from the response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { guest_password: _guestPw, ...safeOrder } = order;

    return NextResponse.json({ success: true, data: safeOrder });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message ?? '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    console.error('POST /orders/guest/lookup error:', error);
    return NextResponse.json(
      { success: false, error: '비회원 주문 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
