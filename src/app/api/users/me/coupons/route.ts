import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const registerCouponSchema = z.object({
  code: z.string().min(1, '쿠폰 코드를 입력해 주세요.').trim(),
});

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
    const status = searchParams.get('status'); // 'unused' | 'used' | 'expired'
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const offset = (page - 1) * limit;

    let query = supabase
      .from('user_coupons')
      .select(
        `
        *,
        coupon:coupons(
          id,
          code,
          name,
          discount_type,
          discount_value,
          min_order_amount,
          max_discount_amount,
          expires_at
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

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: '쿠폰 목록을 불러오는 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    const totalPages = Math.ceil((count ?? 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        coupons: data,
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
    console.error('GET /users/me/coupons error:', error);
    return NextResponse.json(
      { success: false, error: '쿠폰 목록을 불러오는 중 오류가 발생했습니다.' },
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
    const { code } = registerCouponSchema.parse(body);

    // Look up coupon by code
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (couponError || !coupon) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 쿠폰 코드입니다.' },
        { status: 404 }
      );
    }

    // Check if coupon is active
    if (!coupon.is_active) {
      return NextResponse.json(
        { success: false, error: '사용할 수 없는 쿠폰입니다.' },
        { status: 400 }
      );
    }

    // Check if coupon is expired
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: '만료된 쿠폰입니다.' },
        { status: 400 }
      );
    }

    // Check if user already has this coupon
    const { data: existingUserCoupon } = await supabase
      .from('user_coupons')
      .select('id')
      .eq('user_id', user.id)
      .eq('coupon_id', coupon.id)
      .single();

    if (existingUserCoupon) {
      return NextResponse.json(
        { success: false, error: '이미 등록된 쿠폰입니다.' },
        { status: 400 }
      );
    }

    // Register coupon for user
    const { data: userCoupon, error: insertError } = await supabase
      .from('user_coupons')
      .insert({
        user_id: user.id,
        coupon_id: coupon.id,
        status: 'unused',
        expires_at: coupon.expires_at,
      })
      .select(
        `
        *,
        coupon:coupons(
          id,
          code,
          name,
          discount_type,
          discount_value,
          min_order_amount,
          max_discount_amount,
          expires_at
        )
      `
      )
      .single();

    if (insertError) {
      return NextResponse.json(
        { success: false, error: '쿠폰 등록 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: userCoupon }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message ?? '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    console.error('POST /users/me/coupons error:', error);
    return NextResponse.json(
      { success: false, error: '쿠폰 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
