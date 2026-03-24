import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const { data: notice, error } = await supabase
      .from('notices')
      .select('id, title, content, is_pinned, view_count, created_at')
      .eq('id', id)
      .single();

    if (error || !notice) {
      return NextResponse.json({ success: false, error: '공지사항을 찾을 수 없습니다.' }, { status: 404 });
    }

    // Increment view_count
    // Use rpc if available, otherwise use a direct update
    const { error: rpcError } = await supabase.rpc('increment_notice_view_count', { notice_id: id });
    if (rpcError) {
      // Fallback: direct update
      await supabase
        .from('notices')
        .update({ view_count: (notice.view_count || 0) + 1 })
        .eq('id', id);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...notice,
        view_count: (notice.view_count || 0) + 1,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '공지사항을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
