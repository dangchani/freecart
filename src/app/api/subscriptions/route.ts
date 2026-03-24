import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const DISCOUNT_RATES: Record<string, number> = {
  weekly: 0.05,
  biweekly: 0.03,
  monthly: 0.10,
};

const DAY_OF_WEEK_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const createSubscriptionSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional().nullable(),
  quantity: z.number().int().positive(),
  cycle: z.enum(['weekly', 'biweekly', 'monthly']),
  deliveryDay: z.enum(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)'),
  addressId: z.string().uuid(),
});

function calculateNextDeliveryDate(startDate: string, cycle: string, deliveryDay: string): string {
  const targetDow = DAY_OF_WEEK_MAP[deliveryDay];
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the first occurrence of the target day on or after startDate
  let candidate = new Date(start > today ? start : today);
  while (candidate.getDay() !== targetDow) {
    candidate.setDate(candidate.getDate() + 1);
  }

  return candidate.toISOString().slice(0, 10);
}

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
    const status = searchParams.get('status') ?? 'active';

    let query = supabase
      .from('user_subscriptions')
      .select(`
        *,
        product:products(id, name, slug, price, thumbnail_url)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: '구독 목록을 불러오는 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error) {
    console.error('GET /subscriptions error:', error);
    return NextResponse.json(
      { success: false, error: '구독 목록을 불러오는 중 오류가 발생했습니다.' },
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
    const subData = createSubscriptionSchema.parse(body);

    // Fetch product to get base price
    let pricePerDelivery = 0;
    if (subData.variantId) {
      const { data: variant } = await supabase
        .from('product_variants')
        .select('price')
        .eq('id', subData.variantId)
        .eq('product_id', subData.productId)
        .single();

      if (!variant) {
        return NextResponse.json(
          { success: false, error: '상품 옵션을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }
      pricePerDelivery = (variant as { price: number }).price * subData.quantity;
    } else {
      const { data: product } = await supabase
        .from('products')
        .select('price, is_active')
        .eq('id', subData.productId)
        .single();

      if (!product || !product.is_active) {
        return NextResponse.json(
          { success: false, error: '상품을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }
      pricePerDelivery = product.price * subData.quantity;
    }

    // Validate address belongs to user
    const { data: address } = await supabase
      .from('user_addresses')
      .select('id')
      .eq('id', subData.addressId)
      .eq('user_id', user.id)
      .single();

    if (!address) {
      return NextResponse.json(
        { success: false, error: '배송지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Calculate discount
    const discountRate = DISCOUNT_RATES[subData.cycle] ?? 0;
    const discountedPrice = Math.round(pricePerDelivery * (1 - discountRate));

    // Calculate next delivery date
    const nextDeliveryDate = calculateNextDeliveryDate(
      subData.startDate,
      subData.cycle,
      subData.deliveryDay
    );

    const { data: subscription, error: insertError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: user.id,
        product_id: subData.productId,
        variant_id: subData.variantId ?? null,
        quantity: subData.quantity,
        cycle: subData.cycle,
        delivery_day: subData.deliveryDay,
        next_delivery_date: nextDeliveryDate,
        price_per_delivery: discountedPrice,
        discount_rate: discountRate,
        address_id: subData.addressId,
        status: 'active',
        delivery_count: 0,
      })
      .select(`
        *,
        product:products(id, name, slug, price, thumbnail_url)
      `)
      .single();

    if (insertError) {
      return NextResponse.json(
        { success: false, error: '구독 신청 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: subscription }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message ?? '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    console.error('POST /subscriptions error:', error);
    return NextResponse.json(
      { success: false, error: '구독 신청 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
