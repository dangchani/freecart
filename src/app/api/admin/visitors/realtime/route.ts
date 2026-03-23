import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // Count unique sessions in last 15 minutes
    const { data, error } = await supabase
      .from('visitor_logs')
      .select('session_id')
      .gte('created_at', fifteenMinutesAgo);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    const uniqueSessions = new Set((data || []).map((row) => row.session_id)).size;

    // Also get page view count and user vs guest breakdown
    const { data: recentLogs } = await supabase
      .from('visitor_logs')
      .select('session_id, user_id, page_url')
      .gte('created_at', fifteenMinutesAgo);

    const logs = recentLogs || [];
    const uniqueSessionIds = new Set(logs.map((r) => r.session_id));
    const authenticatedSessions = new Set(
      logs.filter((r) => r.user_id).map((r) => r.session_id)
    );

    const pageCounts: Record<string, number> = {};
    logs.forEach((row) => {
      if (row.page_url) {
        pageCounts[row.page_url] = (pageCounts[row.page_url] || 0) + 1;
      }
    });

    const topPages = Object.entries(pageCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([page_url, views]) => ({ page_url, views }));

    return NextResponse.json({
      success: true,
      data: {
        active_visitors: uniqueSessionIds.size,
        authenticated_visitors: authenticatedSessions.size,
        guest_visitors: uniqueSessionIds.size - authenticatedSessions.size,
        page_views_15min: logs.length,
        top_pages: topPages,
        window_minutes: 15,
        as_of: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '실시간 방문자 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
