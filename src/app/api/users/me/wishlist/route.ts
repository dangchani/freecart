import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const addWishlistSchema = z.object({
  product_id: z.string().uuid('올바른 상품 ID 형식이 아닙니다.'),
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
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('user_wishlist')
      .select(
        `
        id,
        product_id,
        created_at,
        product:products(
          id,
          name,
          slug,
          sale_price,
          primary_image
        )
      `,
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { success: false, error: '위시리스트를 불러오는 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    const totalPages = Math.ceil((count ?? 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        items: data,
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
    console.error('GET /users/me/wishlist error:', error);
    return NextResponse.json(
      { success: false, error: '위시리스트를 불러오는 중 오류가 발생했습니다.' },
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
    const { product_id } = addWishlistSchema.parse(body);

    // Verify product exists
    const { data: product } = await supabase
      .from('products')
      .select('id, name')
      .eq('id', product_id)
      .single();

    if (!product) {
      return NextResponse.json(
        { success: false, error: '상품을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Check if already in wishlist
    const { data: existing } = await supabase
      .from('user_wishlist')
      .select('id')
      .eq('user_id', user.id)
      .eq('product_id', product_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 위시리스트에 추가된 상품입니다.' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('user_wishlist')
      .insert({
        user_id: user.id,
        product_id,
      })
      .select(
        `
        id,
        product_id,
        created_at,
        product:products(
          id,
          name,
          slug,
          sale_price,
          primary_image
        )
      `
      )
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: '위시리스트 추가 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message ?? '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    console.error('POST /users/me/wishlist error:', error);
    return NextResponse.json(
      { success: false, error: '위시리스트 추가 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
