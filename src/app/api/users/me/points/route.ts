import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    const type = searchParams.get('type'); // 'earn' | 'use' | 'expire'

    // Get current points balance from users table
    const { data: userData } = await supabase
      .from('users')
      .select('points')
      .eq('id', user.id)
      .single();

    // Build query for history
    let query = supabase
      .from('user_points_history')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq('type', type);
    }

    const { data: history, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: '포인트 내역을 불러오는 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    const totalPages = Math.ceil((count ?? 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        balance: userData?.points ?? 0,
        history,
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
    console.error('GET /users/me/points error:', error);
    return NextResponse.json(
      { success: false, error: '포인트 내역을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
