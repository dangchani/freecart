import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const MAX_RECENTLY_VIEWED = 20;

const addRecentlyViewedSchema = z.object({
  product_id: z.string().uuid('올바른 상품 ID 형식이 아닙니다.'),
});

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
      .from('user_recently_viewed')
      .select(
        `
        id,
        product_id,
        viewed_at,
        product:products(
          id,
          name,
          slug,
          sale_price,
          primary_image
        )
      `
      )
      .eq('user_id', user.id)
      .order('viewed_at', { ascending: false })
      .limit(MAX_RECENTLY_VIEWED);

    if (error) {
      return NextResponse.json(
        { success: false, error: '최근 본 상품을 불러오는 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('GET /users/me/recently-viewed error:', error);
    return NextResponse.json(
      { success: false, error: '최근 본 상품을 불러오는 중 오류가 발생했습니다.' },
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
    const { product_id } = addRecentlyViewedSchema.parse(body);

    // Verify product exists
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('id', product_id)
      .single();

    if (!product) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Upsert: update viewed_at if already exists, insert if not
    const { error: upsertError } = await supabase
      .from('user_recently_viewed')
      .upsert(
        {
          user_id: user.id,
          product_id,
          viewed_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,product_id',
        }
      );

    if (upsertError) {
      return NextResponse.json(
        { success: false, error: '최근 본 상품 추가 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    // Enforce MAX_RECENTLY_VIEWED limit: delete oldest entries beyond the limit
    const { data: allViewed } = await supabase
      .from('user_recently_viewed')
      .select('id, viewed_at')
      .eq('user_id', user.id)
      .order('viewed_at', { ascending: false });

    if (allViewed && allViewed.length > MAX_RECENTLY_VIEWED) {
      const toDelete = allViewed.slice(MAX_RECENTLY_VIEWED).map((item) => item.id);
      await supabase.from('user_recently_viewed').delete().in('id', toDelete);
    }

    return NextResponse.json({
      success: true,
      data: { message: '최근 본 상품에 추가되었습니다.' },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message ?? '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    console.error('POST /users/me/recently-viewed error:', error);
    return NextResponse.json(
      { success: false, error: '최근 본 상품 추가 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
