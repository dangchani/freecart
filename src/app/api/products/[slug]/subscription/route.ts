import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = await createClient();
    const { slug } = await params;

    // Resolve product
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('slug', slug)
      .single();

    if (productError || !product) {
      return NextResponse.json({ success: false, error: '상품을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data: subscription, error } = await supabase
      .from('product_subscriptions')
      .select('id, product_id, is_available, plans, created_at')
      .eq('product_id', product.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    if (!subscription) {
      return NextResponse.json({
        success: true,
        data: {
          is_available: false,
          plans: [],
        },
      });
    }

    return NextResponse.json({ success: true, data: subscription });
  } catch {
    return NextResponse.json(
      { success: false, error: '구독 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
