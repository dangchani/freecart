import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = await createClient();
    const { slug } = await params;

    const { data: page, error } = await supabase
      .from('content_pages')
      .select(
        'id, title, slug, content, type, excerpt, is_visible, seo_title, seo_description, seo_keywords, view_count, created_at, updated_at'
      )
      .eq('slug', slug)
      .eq('is_visible', true)
      .single();

    if (error || !page) {
      return NextResponse.json({ success: false, error: '페이지를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Increment view_count
    const { error: rpcError } = await supabase.rpc('increment_page_view_count', { page_id: page.id });
    if (rpcError) {
      // Fallback: direct update
      await supabase
        .from('content_pages')
        .update({ view_count: (page.view_count || 0) + 1 })
        .eq('id', page.id);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...page,
        view_count: (page.view_count || 0) + 1,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '페이지를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
