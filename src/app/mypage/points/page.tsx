import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Coins } from 'lucide-react';
import { format } from 'date-fns';

type FilterType = 'all' | 'earn' | 'use' | 'expire';

interface PointHistory {
  id: string;
  type: 'earn' | 'use' | 'expire';
  amount: number;
  balance: number;
  description: string;
  createdAt: string;
}

interface PointData {
  balance: number;
  history: PointHistory[];
  totalPages: number;
  totalCount: number;
}

const filterLabels: Record<FilterType, string> = {
  all: '전체',
  earn: '적립',
  use: '사용',
  expire: '소멸',
};

export default function PointsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<PointData>({ balance: 0, history: [], totalPages: 1, totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      fetchPoints();
    }
  }, [user, authLoading, filter, page, navigate]);

  async function fetchPoints() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (filter !== 'all') params.set('type', filter);
      const res = await fetch(`/api/users/me/points?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('포인트 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  const typeColors: Record<string, string> = {
    earn: 'text-blue-600',
    use: 'text-red-500',
    expire: 'text-gray-400',
  };

  const typeLabels: Record<string, string> = {
    earn: '적립',
    use: '사용',
    expire: '소멸',
  };

  if (authLoading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">포인트</h1>

      {/* 잔액 카드 */}
      <Card className="mb-6 bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
        <div className="flex items-center gap-3">
          <Coins className="h-8 w-8 opacity-80" />
          <div>
            <p className="text-sm opacity-80">보유 포인트</p>
            <p className="text-3xl font-bold">{(data.balance || 0).toLocaleString()}P</p>
          </div>
        </div>
      </Card>

      {/* 필터 탭 */}
      <div className="mb-4 flex gap-2">
        {(Object.keys(filterLabels) as FilterType[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setFilter(f); setPage(1); }}
          >
            {filterLabels[f]}
          </Button>
        ))}
      </div>

      {/* 히스토리 테이블 */}
      <Card>
        {loading ? (
          <div className="p-8 text-center text-gray-500">로딩 중...</div>
        ) : data.history.length === 0 ? (
          <div className="p-8 text-center text-gray-500">내역이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">날짜</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">내용</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">구분</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">변동포인트</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">잔액</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.history.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">
                      {format(new Date(item.createdAt), 'yyyy.MM.dd')}
                    </td>
                    <td className="px-4 py-3">{item.description}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant="outline" className="text-xs">
                        {typeLabels[item.type] || item.type}
                      </Badge>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${typeColors[item.type] || ''}`}>
                      {item.type === 'earn' ? '+' : '-'}{Math.abs(item.amount).toLocaleString()}P
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {item.balance.toLocaleString()}P
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 페이지네이션 */}
      {data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            이전
          </Button>
          <span className="text-sm text-gray-600">
            {page} / {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}
