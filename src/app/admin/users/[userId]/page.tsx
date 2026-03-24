import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';

interface UserDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  level: string;
  points: number;
  createdAt: string;
  isBlocked: boolean;
  memo: string;
  address: string;
  orders?: Order[];
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

const levelOptions = [
  { value: 'bronze', label: '브론즈' },
  { value: 'silver', label: '실버' },
  { value: 'gold', label: '골드' },
  { value: 'vip', label: 'VIP' },
];

const statusLabels: Record<string, string> = {
  pending: '결제 대기',
  paid: '결제 완료',
  preparing: '배송 준비중',
  shipping: '배송중',
  delivered: '배송 완료',
  cancelled: '취소됨',
};

export default function AdminUserDetailPage() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { user, loading: authLoading } = useAuth();

  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingMemo, setEditingMemo] = useState(false);
  const [memo, setMemo] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');

  const [pointAction, setPointAction] = useState<'add' | 'subtract'>('add');
  const [pointAmount, setPointAmount] = useState('');
  const [pointReason, setPointReason] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadUser();
    }
  }, [user, authLoading, navigate]);

  async function loadUser() {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/users/${userId}`);
      const data = await response.json();

      if (data.success) {
        setUserDetail(data.data);
        setMemo(data.data.memo || '');
        setSelectedLevel(data.data.level || 'bronze');
      } else {
        setError(data.error || '회원 정보를 불러오지 못했습니다.');
      }
    } catch {
      setError('회원 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveMemo() {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      setEditingMemo(false);
      await loadUser();
    } catch (err) {
      alert(err instanceof Error ? err.message : '메모 저장 중 오류가 발생했습니다.');
    }
  }

  async function handleChangeLevel() {
    if (!confirm(`등급을 ${selectedLevel}(으)로 변경하시겠습니까?`)) return;
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: selectedLevel }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      alert('등급이 변경되었습니다.');
      await loadUser();
    } catch (err) {
      alert(err instanceof Error ? err.message : '등급 변경 중 오류가 발생했습니다.');
    }
  }

  async function handlePointSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseInt(pointAmount);
    if (!amount || amount <= 0) {
      alert('올바른 포인트 금액을 입력해주세요.');
      return;
    }
    try {
      const response = await fetch(`/api/admin/users/${userId}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: pointAction,
          amount,
          reason: pointReason,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      alert('포인트가 처리되었습니다.');
      setPointAmount('');
      setPointReason('');
      await loadUser();
    } catch (err) {
      alert(err instanceof Error ? err.message : '포인트 처리 중 오류가 발생했습니다.');
    }
  }

  async function handleToggleBlock() {
    if (!userDetail) return;
    const action = userDetail.isBlocked ? '차단 해제' : '차단';
    if (!confirm(`해당 회원을 ${action}하시겠습니까?`)) return;
    try {
      const response = await fetch(`/api/admin/users/${userId}/block`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked: !userDetail.isBlocked }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      await loadUser();
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.');
    }
  }

  if (authLoading || loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  if (error) {
    return (
      <div className="container py-8">
        <div className="rounded-md bg-red-50 p-4 text-red-700">{error}</div>
      </div>
    );
  }

  if (!userDetail) return null;

  return (
    <div className="container py-8">
      <Link
        to="/admin/users"
        className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        회원 목록으로 돌아가기
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">회원 상세: {userDetail.name}</h1>
        <Button
          variant={userDetail.isBlocked ? 'outline' : 'destructive'}
          onClick={handleToggleBlock}
        >
          {userDetail.isBlocked ? '차단 해제' : '회원 차단'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 기본 정보 */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">기본 정보</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">이름</dt>
              <dd className="font-medium">{userDetail.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">이메일</dt>
              <dd>{userDetail.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">전화번호</dt>
              <dd>{userDetail.phone || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">주소</dt>
              <dd>{userDetail.address || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">가입일</dt>
              <dd>{userDetail.createdAt ? format(new Date(userDetail.createdAt), 'yyyy.MM.dd HH:mm') : '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">상태</dt>
              <dd>
                <Badge variant={userDetail.isBlocked ? 'destructive' : 'default'}>
                  {userDetail.isBlocked ? '차단됨' : '정상'}
                </Badge>
              </dd>
            </div>
          </dl>
        </Card>

        {/* 등급 및 포인트 */}
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">등급 및 포인트</h2>
          <div className="mb-4">
            <p className="mb-1 text-sm text-gray-500">현재 포인트</p>
            <p className="text-2xl font-bold">{(userDetail.points || 0).toLocaleString()}P</p>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">등급 변경</label>
            <div className="flex gap-2">
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {levelOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Button onClick={handleChangeLevel} size="sm">변경</Button>
            </div>
          </div>

          <form onSubmit={handlePointSubmit}>
            <label className="mb-1 block text-sm font-medium text-gray-700">포인트 조정</label>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => setPointAction('add')}
                className={`flex-1 rounded-md border py-2 text-sm transition-colors ${
                  pointAction === 'add' ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                지급
              </button>
              <button
                type="button"
                onClick={() => setPointAction('subtract')}
                className={`flex-1 rounded-md border py-2 text-sm transition-colors ${
                  pointAction === 'subtract' ? 'bg-red-600 text-white border-red-600' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                차감
              </button>
            </div>
            <input
              type="number"
              placeholder="포인트 금액"
              value={pointAmount}
              onChange={(e) => setPointAmount(e.target.value)}
              min="1"
              className="mb-2 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="사유"
              value={pointReason}
              onChange={(e) => setPointReason(e.target.value)}
              className="mb-2 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button type="submit" className="w-full">포인트 처리</Button>
          </form>
        </Card>

        {/* 메모 */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">관리자 메모</h2>
            {!editingMemo && (
              <Button size="sm" variant="outline" onClick={() => setEditingMemo(true)}>
                편집
              </Button>
            )}
          </div>
          {editingMemo ? (
            <div>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={4}
                className="mb-3 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="관리자 메모를 입력하세요"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveMemo}>저장</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingMemo(false)}>
                  취소
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {userDetail.memo || '메모 없음'}
            </p>
          )}
        </Card>
      </div>

      {/* 주문 내역 */}
      <Card className="mt-6 p-6">
        <h2 className="mb-4 text-lg font-bold">주문 내역</h2>
        {!userDetail.orders || userDetail.orders.length === 0 ? (
          <p className="text-sm text-gray-500">주문 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">주문번호</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">상태</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">금액</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">주문일</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {userDetail.orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{order.orderNumber}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{statusLabels[order.status] || order.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">{formatCurrency(order.totalAmount)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {order.createdAt ? format(new Date(order.createdAt), 'yyyy.MM.dd') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
