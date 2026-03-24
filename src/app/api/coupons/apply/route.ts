import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const applySchema = z.object({
  couponId: z.string().uuid('유효한 쿠폰 ID를 입력해 주세요.'),
  orderAmount: z.number().positive('주문 금액이 올바르지 않습니다.'),
  productIds: z.array(z.string().uuid()).optional().default([]),
});

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
    const { couponId, orderAmount, productIds } = applySchema.parse(body);

    // Fetch user coupon with coupon details
    const { data: userCoupon, error: fetchError } = await supabase
      .from('user_coupons')
      .select(`
        id, status, expires_at,
        coupon:coupons(
          id,
          name,
          code,
          discount_type,
          discount_value,
          min_order_amount,
          max_discount_amount,
          expires_at,
          is_active,
          applicable_product_ids
        )
      `)
      .eq('id', couponId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !userCoupon) {
      return NextResponse.json(
        {
          success: true,
          data: { isValid: false, discount: 0, couponName: '', reason: '쿠폰을 찾을 수 없습니다.' },
        },
        { status: 200 }
      );
    }

    const coupon = userCoupon.coupon as {
      id: string;
      name: string;
      code: string;
      discount_type: string;
      discount_value: number;
      min_order_amount?: number;
      max_discount_amount?: number;
      expires_at?: string;
      is_active: boolean;
      applicable_product_ids?: string[];
    } | null;

    if (!coupon) {
      return NextResponse.json(
        {
          success: true,
          data: { isValid: false, discount: 0, couponName: '', reason: '쿠폰 정보를 불러올 수 없습니다.' },
        }
      );
    }

    // Check coupon status
    if (userCoupon.status !== 'unused') {
      return NextResponse.json({
        success: true,
        data: {
          isValid: false,
          discount: 0,
          couponName: coupon.name,
          reason: userCoupon.status === 'used' ? '이미 사용된 쿠폰입니다.' : '만료된 쿠폰입니다.',
        },
      });
    }

    // Check coupon is_active
    if (!coupon.is_active) {
      return NextResponse.json({
        success: true,
        data: { isValid: false, discount: 0, couponName: coupon.name, reason: '비활성화된 쿠폰입니다.' },
      });
    }

    // Check coupon expiry
    const expiresAt = coupon.expires_at ?? userCoupon.expires_at;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return NextResponse.json({
        success: true,
        data: { isValid: false, discount: 0, couponName: coupon.name, reason: '만료된 쿠폰입니다.' },
      });
    }

    // Check minimum order amount
    if (coupon.min_order_amount && orderAmount < coupon.min_order_amount) {
      return NextResponse.json({
        success: true,
        data: {
          isValid: false,
          discount: 0,
          couponName: coupon.name,
          reason: `최소 주문 금액 ${coupon.min_order_amount.toLocaleString()}원 이상 주문 시 사용 가능합니다.`,
        },
      });
    }

    // Check applicable products (if restricted)
    if (
      coupon.applicable_product_ids &&
      coupon.applicable_product_ids.length > 0 &&
      productIds.length > 0
    ) {
      const hasApplicable = productIds.some((pid) =>
        coupon.applicable_product_ids!.includes(pid)
      );
      if (!hasApplicable) {
        return NextResponse.json({
          success: true,
          data: {
            isValid: false,
            discount: 0,
            couponName: coupon.name,
            reason: '이 쿠폰은 해당 상품에는 적용할 수 없습니다.',
          },
        });
      }
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      discount = Math.floor(orderAmount * (coupon.discount_value / 100));
      if (coupon.max_discount_amount) {
        discount = Math.min(discount, coupon.max_discount_amount);
      }
    } else {
      // fixed amount
      discount = Math.min(coupon.discount_value, orderAmount);
    }

    return NextResponse.json({
      success: true,
      data: {
        isValid: true,
        discount,
        couponName: coupon.name,
        couponCode: coupon.code,
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
        finalAmount: orderAmount - discount,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message ?? '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    console.error('POST /coupons/apply error:', error);
    return NextResponse.json(
      { success: false, error: '쿠폰 적용 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
