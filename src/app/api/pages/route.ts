import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

const VALID_TYPES = ['custom', 'terms', 'privacy', 'about'] as const;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const typeParam = searchParams.get('type');
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('content_pages')
      .select(
        'id, title, slug, type, excerpt, is_visible, seo_title, seo_description, seo_keywords, view_count, created_at, updated_at',
        { count: 'exact' }
      )
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (typeParam && (VALID_TYPES as readonly string[]).includes(typeParam)) {
      query = query.eq('type', typeParam);
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
      { success: false, error: '페이지 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
