import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_STATUSES = [
  'pending',
  'paid',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)));
    const offset = (page - 1) * limit;
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      return NextResponse.json(
        { success: false, error: '올바르지 않은 주문 상태입니다.' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('orders')
      .select(
        `
        id,
        order_number,
        status,
        payment_status,
        subtotal,
        shipping_cost,
        discount,
        total,
        shipping_name,
        shipping_address,
        shipping_phone,
        payment_method,
        memo,
        created_at,
        items:order_items(
          id,
          product_id,
          product_name,
          price,
          quantity,
          options
        )
      `,
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
    }

    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: '주문 목록을 불러오는 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    const totalPages = Math.ceil((count ?? 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        orders: data,
        pagination: {
          page,
          limit,
          total: count ?? 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('GET /users/me/orders error:', error);
    return NextResponse.json(
      { success: false, error: '주문 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
