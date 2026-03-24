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
    const productId = searchParams.get('product') || searchParams.get('productId');
    const rating = searchParams.get('rating');
    const isVisible = searchParams.get('isVisible');
    const isBest = searchParams.get('isBest');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('reviews')
      .select('*, products(id, name), users(id, name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (productId) {
      query = query.eq('product_id', productId);
    }
    if (rating) {
      query = query.eq('rating', parseInt(rating));
    }
    if (isVisible !== null && isVisible !== '') {
      query = query.eq('is_visible', isVisible === 'true');
    }
    if (isBest !== null && isBest !== '') {
      query = query.eq('is_best', isBest === 'true');
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '리뷰 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
