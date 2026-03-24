import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const createOrderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
      price: z.number().positive(),
      options: z.record(z.string()).optional(),
    })
  ),
  shippingAddress: z.string().min(1),
  shippingPhone: z.string().min(1),
  shippingName: z.string().min(1),
  paymentMethod: z.string(),
  memo: z.string().optional(),
});

function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `ORD-${year}${month}${day}-${random}`;
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('orders')
      .select(
        `
        *,
        items:order_items(*)
      `
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '주문 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const orderData = createOrderSchema.parse(body);

    const subtotal = orderData.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const shippingCost = subtotal >= 50000 ? 0 : 3000;
    const total = subtotal + shippingCost;

    // 주문 생성
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: generateOrderNumber(),
        user_id: user.id,
        subtotal,
        shipping_cost: shippingCost,
        discount: 0,
        total,
        shipping_address: orderData.shippingAddress,
        shipping_phone: orderData.shippingPhone,
        shipping_name: orderData.shippingName,
        payment_method: orderData.paymentMethod,
        memo: orderData.memo,
        status: 'pending',
        payment_status: 'pending',
      })
      .select()
      .single();

    if (orderError) {
      return NextResponse.json({ success: false, error: orderError.message }, { status: 400 });
    }

    // 주문 항목 생성
    const orderItems = await Promise.all(
      orderData.items.map(async (item) => {
        const { data: product } = await supabase
          .from('products')
          .select('name')
          .eq('id', item.productId)
          .single();

        return {
          order_id: order.id,
          product_id: item.productId,
          product_name: product?.name || '',
          price: item.price,
          quantity: item.quantity,
          options: item.options,
        };
      })
    );

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

    if (itemsError) {
      return NextResponse.json({ success: false, error: itemsError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '주문 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
