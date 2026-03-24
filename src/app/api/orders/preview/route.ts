import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const previewSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      variantId: z.string().uuid().optional(),
      quantity: z.number().int().positive(),
    })
  ).min(1),
  couponId: z.string().uuid().optional().nullable(),
  usePoints: z.number().int().min(0).optional().default(0),
  useDeposit: z.number().int().min(0).optional().default(0),
  shippingAddressId: z.string().uuid().optional().nullable(),
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
    const parsed = previewSchema.parse(body);

    // Fetch user profile for points and deposit
    const { data: userProfile } = await supabase
      .from('users')
      .select('points, deposit')
      .eq('id', user.id)
      .single();

    const availablePoints = userProfile?.points ?? 0;
    const availableDeposit = userProfile?.deposit ?? 0;

    // Validate usePoints/useDeposit don't exceed available
    const usePoints = Math.min(parsed.usePoints ?? 0, availablePoints);
    const useDeposit = Math.min(parsed.useDeposit ?? 0, availableDeposit);

    // Fetch products and calculate subtotal
    let subtotal = 0;
    const itemDetails: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
      price: number;
      productName: string;
    }> = [];

    for (const item of parsed.items) {
      let price = 0;
      let productName = '';

      if (item.variantId) {
        const { data: variant } = await supabase
          .from('product_variants')
          .select('price, product:products(name, price)')
          .eq('id', item.variantId)
          .eq('product_id', item.productId)
          .single();

        if (!variant) {
          return NextResponse.json(
            { success: false, error: `상품 옵션을 찾을 수 없습니다: ${item.variantId}` },
            { status: 404 }
          );
        }
        price = (variant as { price: number; product?: { name?: string; price?: number } }).price;
        productName = (variant as { price: number; product?: { name?: string; price?: number } }).product?.name ?? '';
      } else {
        const { data: product } = await supabase
          .from('products')
          .select('price, name')
          .eq('id', item.productId)
          .single();

        if (!product) {
          return NextResponse.json(
            { success: false, error: `상품을 찾을 수 없습니다: ${item.productId}` },
            { status: 404 }
          );
        }
        price = product.price;
        productName = product.name;
      }

      subtotal += price * item.quantity;
      itemDetails.push({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        price,
        productName,
      });
    }

    // Apply coupon discount
    let couponDiscount = 0;
    let appliedCoupon: Record<string, unknown> | null = null;

    if (parsed.couponId) {
      const { data: userCoupon } = await supabase
        .from('user_coupons')
        .select(`
          *,
          coupon:coupons(
            id, name, discount_type, discount_value,
            min_order_amount, max_discount_amount, expires_at
          )
        `)
        .eq('id', parsed.couponId)
        .eq('user_id', user.id)
        .eq('status', 'unused')
        .single();

      if (userCoupon && userCoupon.coupon) {
        const coupon = userCoupon.coupon as {
          id: string;
          name: string;
          discount_type: string;
          discount_value: number;
          min_order_amount?: number;
          max_discount_amount?: number;
          expires_at?: string;
        };
        const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
        const meetsMinAmount = !coupon.min_order_amount || subtotal >= coupon.min_order_amount;

        if (!isExpired && meetsMinAmount) {
          if (coupon.discount_type === 'percentage') {
            couponDiscount = Math.floor(subtotal * (coupon.discount_value / 100));
            if (coupon.max_discount_amount) {
              couponDiscount = Math.min(couponDiscount, coupon.max_discount_amount);
            }
          } else {
            couponDiscount = coupon.discount_value;
          }
          appliedCoupon = coupon;
        }
      }
    }

    // Shipping fee calculation
    const afterCoupon = Math.max(0, subtotal - couponDiscount);
    const shippingFee = afterCoupon >= 50000 ? 0 : 3000;

    // Deduct points and deposit
    const pointsAmount = usePoints; // 1 point = 1 won
    const depositAmount = useDeposit;

    const totalBeforeDeductions = afterCoupon + shippingFee;
    const finalAmount = Math.max(0, totalBeforeDeductions - pointsAmount - depositAmount);

    // Earned points (1% of final amount)
    const earnedPoints = Math.floor(finalAmount * 0.01);

    // Fetch available coupons for user
    const { data: availableCoupons } = await supabase
      .from('user_coupons')
      .select(`
        *,
        coupon:coupons(
          id, code, name, discount_type, discount_value,
          min_order_amount, max_discount_amount, expires_at
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'unused')
      .gt('coupon.expires_at', new Date().toISOString());

    return NextResponse.json({
      success: true,
      data: {
        items: itemDetails,
        pricing: {
          subtotal,
          couponDiscount,
          shippingFee,
          pointsUsed: pointsAmount,
          depositUsed: depositAmount,
          total: finalAmount,
          earnedPoints,
        },
        appliedCoupon,
        user: {
          availablePoints,
          availableDeposit,
        },
        availableCoupons: availableCoupons ?? [],
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /orders/preview error:', error);
    return NextResponse.json(
      { success: false, error: '주문 미리보기 계산 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
