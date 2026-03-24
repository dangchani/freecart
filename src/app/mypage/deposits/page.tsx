import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

interface DepositHistory {
  id: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  balance: number;
  description: string;
  createdAt: string;
}

interface DepositData {
  balance: number;
  history: DepositHistory[];
  totalPages: number;
  totalCount: number;
}

export default function DepositsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<DepositData>({ balance: 0, history: [], totalPages: 1, totalCount: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      fetchDeposits();
    }
  }, [user, authLoading, page, navigate]);

  async function fetchDeposits() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      const res = await fetch(`/api/users/me/deposits?${params}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('예치금 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">예치금</h1>

      {/* 잔액 카드 */}
      <Card className="mb-6 bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white">
        <div className="flex items-center gap-3">
          <Wallet className="h-8 w-8 opacity-80" />
          <div>
            <p className="text-sm opacity-80">보유 예치금</p>
            <p className="text-3xl font-bold">{formatCurrency(data.balance || 0)}</p>
          </div>
        </div>
      </Card>

      {/* 히스토리 테이블 */}
      <Card>
        {loading ? (
          <div className="p-8 text-center text-gray-500">로딩 중...</div>
        ) : data.history.length === 0 ? (
          <div className="p-8 text-center text-gray-500">예치금 내역이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">날짜</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">내용</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">변동금액</th>
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
                    <td className={`px-4 py-3 text-right font-medium ${item.type === 'deposit' ? 'text-blue-600' : 'text-red-500'}`}>
                      {item.type === 'deposit' ? '+' : '-'}{formatCurrency(Math.abs(item.amount))}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(item.balance)}
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
            disabled={page === 1 || loading}
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
            disabled={page === data.totalPages || loading}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}
