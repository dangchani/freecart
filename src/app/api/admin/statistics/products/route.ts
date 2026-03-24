import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: adminProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const [topSellingResult, topViewedResult, topRatedResult] = await Promise.all([
      supabase
        .from('order_items')
        .select('product_id, product_name, quantity')
        .order('quantity', { ascending: false })
        .limit(limit * 5),
      supabase
        .from('products')
        .select('id, name, slug, thumbnail, view_count')
        .order('view_count', { ascending: false })
        .limit(limit),
      supabase
        .from('products')
        .select('id, name, slug, thumbnail, average_rating, review_count')
        .not('average_rating', 'is', null)
        .order('average_rating', { ascending: false })
        .order('review_count', { ascending: false })
        .limit(limit),
    ]);

    const sellingMap: Record<string, { productId: string; productName: string; totalQuantity: number }> = {};
    (topSellingResult.data || []).forEach(
      (item: { product_id: string; product_name: string; quantity: number }) => {
        if (!sellingMap[item.product_id]) {
          sellingMap[item.product_id] = {
            productId: item.product_id,
            productName: item.product_name,
            totalQuantity: 0,
          };
        }
        sellingMap[item.product_id].totalQuantity += item.quantity;
      }
    );
    const topSelling = Object.values(sellingMap)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        topSelling,
        topViewed: topViewedResult.data || [],
        topRated: topRatedResult.data || [],
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '상품 통계를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
