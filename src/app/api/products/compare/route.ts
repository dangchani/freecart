import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids') || '';

    if (!idsParam) {
      return NextResponse.json(
        { success: false, error: '비교할 상품 ID를 입력해주세요.' },
        { status: 400 }
      );
    }

    const ids = idsParam
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length < 2) {
      return NextResponse.json(
        { success: false, error: '비교하려면 최소 2개의 상품이 필요합니다.' },
        { status: 400 }
      );
    }

    if (ids.length > 4) {
      return NextResponse.json(
        { success: false, error: '최대 4개의 상품만 비교할 수 있습니다.' },
        { status: 400 }
      );
    }

    const { data: products, error } = await supabase
      .from('products')
      .select(
        `
        id,
        name,
        slug,
        summary,
        regular_price,
        sale_price,
        primary_image,
        is_featured,
        is_new,
        is_best,
        is_sale,
        status,
        review_avg,
        review_count,
        wishlist_count,
        sales_count,
        category_id,
        brand_id,
        tags,
        category:categories(id, name, slug),
        brand:product_brands(id, name, slug, logo_url)
      `
      )
      .in('id', ids)
      .eq('status', 'active');

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    if (!products || products.length === 0) {
      return NextResponse.json(
        { success: false, error: '비교할 상품을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Return in the same order as requested ids
    const orderedProducts = ids
      .map((id) => products.find((p: any) => p.id === id))
      .filter(Boolean);

    return NextResponse.json({ success: true, data: orderedProducts });
  } catch {
    return NextResponse.json(
      { success: false, error: '상품 비교 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
