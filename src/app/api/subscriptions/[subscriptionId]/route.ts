import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const DAY_OF_WEEK_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const updateSubscriptionSchema = z.object({
  quantity: z.number().int().positive().optional(),
  deliveryDay: z.enum(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']).optional(),
  addressId: z.string().uuid().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: '수정할 항목을 입력해 주세요.',
});

function getNextDayOfWeek(dayName: string): string {
  const targetDow = DAY_OF_WEEK_MAP[dayName];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const candidate = new Date(today);
  candidate.setDate(candidate.getDate() + 1); // start from tomorrow
  while (candidate.getDay() !== targetDow) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate.toISOString().slice(0, 10);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { subscriptionId: string } }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: subscription, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        product:products(id, name, slug, price, thumbnail_url),
        variant:product_variants(id, name, price)
      `)
      .eq('id', params.subscriptionId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !subscription) {
      return NextResponse.json(
        { success: false, error: '구독 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Fetch delivery history
    const { data: deliveries } = await supabase
      .from('subscription_deliveries')
      .select('*')
      .eq('subscription_id', params.subscriptionId)
      .order('delivery_number', { ascending: false });

    return NextResponse.json({
      success: true,
      data: {
        ...subscription,
        deliveries: deliveries ?? [],
      },
    });
  } catch (error) {
    console.error('GET /subscriptions/[subscriptionId] error:', error);
    return NextResponse.json(
      { success: false, error: '구독 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { subscriptionId: string } }
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
    const updates = updateSubscriptionSchema.parse(body);

    // Verify subscription belongs to user and is active
    const { data: subscription, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select('id, status, cycle, delivery_day, price_per_delivery, discount_rate, quantity, product_id, variant_id')
      .eq('id', params.subscriptionId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !subscription) {
      return NextResponse.json(
        { success: false, error: '구독 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (subscription.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: '취소된 구독은 수정할 수 없습니다.' },
        { status: 400 }
      );
    }

    // Validate addressId if provided
    if (updates.addressId) {
      const { data: address } = await supabase
        .from('user_addresses')
        .select('id')
        .eq('id', updates.addressId)
        .eq('user_id', user.id)
        .single();

      if (!address) {
        return NextResponse.json(
          { success: false, error: '배송지를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.quantity !== undefined) {
      updatePayload.quantity = updates.quantity;
      // Recalculate price per delivery
      let baseUnitPrice = 0;
      if (subscription.variant_id) {
        const { data: variant } = await supabase
          .from('product_variants')
          .select('price')
          .eq('id', subscription.variant_id)
          .single();
        baseUnitPrice = (variant as { price: number } | null)?.price ?? 0;
      } else {
        const { data: product } = await supabase
          .from('products')
          .select('price')
          .eq('id', subscription.product_id)
          .single();
        baseUnitPrice = (product as { price: number } | null)?.price ?? 0;
      }
      updatePayload.price_per_delivery = Math.round(
        baseUnitPrice * updates.quantity * (1 - (subscription.discount_rate ?? 0))
      );
    }

    if (updates.deliveryDay !== undefined) {
      updatePayload.delivery_day = updates.deliveryDay;
      // Recalculate next delivery date
      updatePayload.next_delivery_date = getNextDayOfWeek(updates.deliveryDay);
    }

    if (updates.addressId !== undefined) {
      updatePayload.address_id = updates.addressId;
    }

    const { data: updated, error: updateError } = await supabase
      .from('user_subscriptions')
      .update(updatePayload)
      .eq('id', params.subscriptionId)
      .select(`
        *,
        product:products(id, name, slug, price, thumbnail_url)
      `)
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: '구독 수정 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message ?? '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    console.error('PATCH /subscriptions/[subscriptionId] error:', error);
    return NextResponse.json(
      { success: false, error: '구독 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
