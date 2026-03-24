import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = await createClient();
    const { slug } = await params;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Resolve product_id from slug
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('slug', slug)
      .single();

    if (productError || !product) {
      return NextResponse.json({ success: false, error: '상품을 찾을 수 없습니다.' }, { status: 404 });
    }

    const productId = product.id;

    // Get all photo reviews for this product, then pull their images
    const { data: reviewImages, error, count } = await supabase
      .from('review_images')
      .select(
        `
        id,
        image_url,
        sort_order,
        review:reviews!inner(
          id,
          rating,
          content,
          created_at,
          is_visible,
          product_id
        )
      `,
        { count: 'exact' }
      )
      .eq('review.product_id', productId)
      .eq('review.is_visible', true)
      .order('created_at', { referencedTable: 'reviews', ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: reviewImages,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '리뷰 이미지를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
