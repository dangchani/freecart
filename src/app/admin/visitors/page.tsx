import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { format, startOfDay, subDays } from 'date-fns';

interface VisitorLog {
  id: string;
  ip_address: string;
  page_url: string;
  user_agent: string;
  created_at: string;
}

interface DailyCount {
  date: string;
  count: number;
}

interface TopPage {
  page_url: string;
  count: number;
}

export default function AdminVisitorsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [todayCount, setTodayCount] = useState(0);
  const [currentHourCount, setCurrentHourCount] = useState(0);
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([]);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [recentVisitors, setRecentVisitors] = useState<VisitorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadStats();
    }
  }, [user, authLoading, navigate]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      loadStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  async function loadStats() {
    try {
      setLoading(true);
      const supabase = createClient();
      const now = new Date();
      const todayStart = startOfDay(now);

      // Today's unique IP count
      const { data: todayData } = await supabase
        .from('visitor_logs')
        .select('ip_address')
        .gte('created_at', todayStart.toISOString());

      const uniqueIpsToday = new Set((todayData || []).map((v) => v.ip_address));
      setTodayCount(uniqueIpsToday.size);

      // Current hour visitors
      const currentHourStart = new Date(now);
      currentHourStart.setMinutes(0, 0, 0);
      const { data: hourData } = await supabase
        .from('visitor_logs')
        .select('ip_address')
        .gte('created_at', currentHourStart.toISOString());

      const uniqueIpsHour = new Set((hourData || []).map((v) => v.ip_address));
      setCurrentHourCount(uniqueIpsHour.size);

      // Last 7 days trend
      const counts: DailyCount[] = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = startOfDay(subDays(now, i));
        const dayEnd = startOfDay(subDays(now, i - 1));

        const { data: dayData } = await supabase
          .from('visitor_logs')
          .select('ip_address')
          .gte('created_at', dayStart.toISOString())
          .lt('created_at', dayEnd.toISOString());

        const uniqueIps = new Set((dayData || []).map((v) => v.ip_address));
        counts.push({
          date: format(dayStart, 'MM/dd'),
          count: uniqueIps.size,
        });
      }
      setDailyCounts(counts);

      // Top pages today
      const { data: pagesData } = await supabase
        .from('visitor_logs')
        .select('page_url')
        .gte('created_at', todayStart.toISOString());

      const pageCounts: Record<string, number> = {};
      (pagesData || []).forEach((v) => {
        pageCounts[v.page_url] = (pageCounts[v.page_url] || 0) + 1;
      });
      const sortedPages = Object.entries(pageCounts)
        .map(([page_url, count]) => ({ page_url, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      setTopPages(sortedPages);

      // Recent visitors
      const { data: recentData } = await supabase
        .from('visitor_logs')
        .select('id, ip_address, page_url, user_agent, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      setRecentVisitors(recentData || []);
      setLastRefresh(new Date());
    } catch {
      setError('방문자 통계를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  const maxDailyCount = Math.max(...dailyCounts.map((d) => d.count), 1);

  if (authLoading || loading) return <div className="p-8">로딩 중...</div>;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">실시간 방문자 통계</h1>
          <p className="mt-1 text-sm text-gray-500">
            마지막 갱신: {format(lastRefresh, 'HH:mm:ss')} (30초마다 자동 갱신)
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <p className="text-sm text-gray-500">오늘 방문자 (고유 IP)</p>
          <p className="mt-2 text-3xl font-bold text-blue-600">{todayCount.toLocaleString()}명</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500">현재 시간대 방문자</p>
          <p className="mt-2 text-3xl font-bold text-green-600">{currentHourCount.toLocaleString()}명</p>
        </Card>
      </div>

      {/* 7-day Trend Bar Chart */}
      <Card className="mb-6 p-6">
        <h2 className="mb-4 text-lg font-bold">최근 7일 방문 추이</h2>
        {dailyCounts.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">데이터가 없습니다.</p>
        ) : (
          <div className="flex items-end gap-3" style={{ height: 200 }}>
            {dailyCounts.map((item) => (
              <div key={item.date} className="flex flex-1 flex-col items-center">
                <span className="mb-1 text-xs font-medium text-gray-700">
                  {item.count}
                </span>
                <div
                  className="w-full rounded-t bg-blue-500 transition-all duration-500"
                  style={{
                    height: `${(item.count / maxDailyCount) * 160}px`,
                    minHeight: item.count > 0 ? '4px' : '0px',
                  }}
                />
                <span className="mt-2 text-xs text-gray-500">{item.date}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        {/* Top Pages */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">오늘 인기 페이지</h2>
          {topPages.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">데이터가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {topPages.map((page, idx) => (
                <div key={page.page_url} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-center font-bold text-gray-400">{idx + 1}</span>
                  <span className="flex-1 truncate font-medium" title={page.page_url}>
                    {page.page_url}
                  </span>
                  <Badge variant="secondary">{page.count}회</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Daily Breakdown */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">일별 방문자 수</h2>
          {dailyCounts.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">데이터가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {dailyCounts.map((item) => (
                <div key={item.date}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-700">{item.date}</span>
                    <span className="text-gray-600">{item.count}명</span>
                  </div>
                  <div className="h-4 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${(item.count / maxDailyCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Visitors Table */}
      <Card>
        <div className="p-6 pb-4">
          <h2 className="text-lg font-bold">최근 방문자</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">IP 주소</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">페이지</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">브라우저</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">방문 시간</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentVisitors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    방문자 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                recentVisitors.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{v.ip_address}</td>
                    <td className="px-4 py-3 max-w-48 truncate" title={v.page_url}>
                      {v.page_url}
                    </td>
                    <td className="px-4 py-3 max-w-48 truncate text-gray-500" title={v.user_agent}>
                      {v.user_agent?.length > 60
                        ? v.user_agent.substring(0, 60) + '...'
                        : v.user_agent}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {v.created_at
                        ? format(new Date(v.created_at), 'yyyy.MM.dd HH:mm:ss')
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
