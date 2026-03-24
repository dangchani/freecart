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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const periodStart = startDate || thirtyDaysAgo.toISOString();
    const periodEnd = endDate || now.toISOString();

    const [totalUsersResult, newUsersResult, activeUsersResult, levelDistributionResult] =
      await Promise.all([
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('is_blocked', false),
        supabase
          .from('users')
          .select('id, created_at', { count: 'exact' })
          .gte('created_at', periodStart)
          .lte('created_at', periodEnd),
        supabase
          .from('orders')
          .select('user_id')
          .gte('created_at', periodStart)
          .lte('created_at', periodEnd),
        supabase
          .from('users')
          .select('level_id, user_levels(name)'),
      ]);

    const activeUserIds = new Set(
      (activeUsersResult.data || []).map((o: { user_id: string }) => o.user_id)
    );

    const levelMap: Record<string, { levelName: string; count: number }> = {};
    (levelDistributionResult.data || []).forEach(
      (u: { level_id: string | null; user_levels: { name: string } | null }) => {
        const key = u.level_id || 'none';
        const levelName = u.user_levels?.name || '기본';
        if (!levelMap[key]) {
          levelMap[key] = { levelName, count: 0 };
        }
        levelMap[key].count++;
      }
    );
    const levelDistribution = Object.entries(levelMap).map(([levelId, info]) => ({
      levelId,
      levelName: info.levelName,
      count: info.count,
    }));

    const newUsersByDate: Record<string, number> = {};
    (newUsersResult.data || []).forEach((u: { created_at: string }) => {
      const date = u.created_at.split('T')[0];
      newUsersByDate[date] = (newUsersByDate[date] || 0) + 1;
    });
    const newUsersChart = Object.entries(newUsersByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return NextResponse.json({
      success: true,
      data: {
        totalUsers: totalUsersResult.count || 0,
        newUsers: newUsersResult.count || 0,
        activeUsers: activeUserIds.size,
        levelDistribution,
        newUsersChart,
        period: { startDate: periodStart, endDate: periodEnd },
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '사용자 통계를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
