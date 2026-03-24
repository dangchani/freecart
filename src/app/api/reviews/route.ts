import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const createReviewSchema = z.object({
  productId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1),
  content: z.string().min(1),
  images: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    let query = supabase
      .from('reviews')
      .select(
        `
        *,
        user:profiles(id, name)
      `
      )
      .order('created_at', { ascending: false });

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '리뷰 목록을 불러오는 중 오류가 발생했습니다.' },
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
    const reviewData = createReviewSchema.parse(body);

    // 구매 여부 확인 (옵션)
    const { data: orders } = await supabase
      .from('orders')
      .select('id, items:order_items(product_id)')
      .eq('user_id', user.id)
      .eq('status', 'delivered');

    const hasPurchased = orders?.some((order) =>
      order.items?.some((item: any) => item.product_id === reviewData.productId)
    );

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        product_id: reviewData.productId,
        user_id: user.id,
        rating: reviewData.rating,
        title: reviewData.title,
        content: reviewData.content,
        images: reviewData.images || [],
        is_verified: hasPurchased || false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '리뷰 작성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
