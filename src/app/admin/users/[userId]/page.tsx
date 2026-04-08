import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getSystemSetting } from '@/lib/permissions';
import { logAdminAction, buildDiff } from '@/lib/admin-log';
import { UserManagersSection } from '@/components/admin/user-managers-section';
import { UserSignupFieldsSection, type UserSignupFieldsSectionHandle } from '@/components/admin/user-signup-fields-section';
import { UserPermissionSection } from '@/components/admin/user-permission-section';

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

  // joy: 기본 정보 편집 상태 (이름/전화번호). 이메일은 수정 불가.
  const [editingBasic, setEditingBasic] = useState(false);
  const [basicForm, setBasicForm] = useState({ name: '', phone: '' });
  const [savingBasic, setSavingBasic] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const signupFieldsRef = useRef<UserSignupFieldsSectionHandle>(null);

  const [pointAction, setPointAction] = useState<'add' | 'subtract'>('add');
  const [pointAmount, setPointAmount] = useState('');
  const [pointReason, setPointReason] = useState('');

  const [useLevels, setUseLevels] = useState(true);
  const [usePoints, setUsePoints] = useState(true);
  const [pointLabel, setPointLabel] = useState('포인트');

  useEffect(() => {
    (async () => {
      const [ul, up, pl] = await Promise.all([
        getSystemSetting<boolean>('use_user_levels'),
        getSystemSetting<boolean>('use_points'),
        getSystemSetting<string>('point_label'),
      ]);
      setUseLevels(ul !== false);
      setUsePoints(up !== false);
      if (typeof pl === 'string' && pl) setPointLabel(pl);
    })();
  }, []);

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
      const supabase = createClient();

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, phone, points, is_blocked, created_at, memo, level_id, user_levels(name)')
        .eq('id', userId!)
        .single();

      if (userError) throw userError;

      // Get default address (없을 수 있으므로 maybeSingle)
      const { data: addressData } = await supabase
        .from('user_addresses')
        .select('address1, address2')
        .eq('user_id', userId!)
        .eq('is_default', true)
        .maybeSingle();

      // Get orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount, created_at')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(20);

      const levelName = (userData.user_levels as any)?.name || '';
      const detail: UserDetail = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        phone: userData.phone || '',
        level: levelName,
        points: userData.points || 0,
        createdAt: userData.created_at,
        isBlocked: userData.is_blocked,
        memo: userData.memo || '',
        address: addressData ? [addressData.address1, addressData.address2].filter(Boolean).join(' ') : '',
        orders: (ordersData || []).map((o) => ({
          id: o.id,
          orderNumber: o.order_number,
          status: o.status,
          totalAmount: o.total_amount,
          createdAt: o.created_at,
        })),
      };

      setUserDetail(detail);
      setMemo(detail.memo);
      setSelectedLevel(detail.level || 'bronze');
      setBasicForm({ name: detail.name, phone: detail.phone });
    } catch {
      setError('회원 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveMemo() {
    try {
      const supabase = createClient();
      const before = userDetail?.memo ?? '';
      const { error: updateError } = await supabase
        .from('users')
        .update({ memo })
        .eq('id', userId!);

      if (updateError) throw updateError;
      if (before !== memo) {
        await logAdminAction({
          action: 'update_memo',
          resourceType: 'users',
          resourceId: userId!,
          details: { before: { memo: before }, after: { memo } },
        });
      }
      setEditingMemo(false);
      await loadUser();
    } catch (err) {
      alert(err instanceof Error ? err.message : '메모 저장 중 오류가 발생했습니다.');
    }
  }

  // joy: 회원 기본정보(이름/전화번호) 저장 + admin_logs 기록
  async function handleSaveBasic() {
    if (!userDetail) return;
    const name = basicForm.name.trim();
    if (!name) {
      alert('이름을 입력해주세요.');
      return;
    }
    const phone = basicForm.phone.trim();
    const diff = buildDiff(
      { name: userDetail.name, phone: userDetail.phone },
      { name, phone },
    );
    const signupHasChanges = signupFieldsRef.current?.hasChanges() ?? false;
    if (!diff && !signupHasChanges) {
      setEditingBasic(false);
      return;
    }
    try {
      setSavingBasic(true);
      if (diff) {
        const supabase = createClient();
        const { error: updateError } = await supabase
          .from('users')
          .update({ name, phone: phone || null })
          .eq('id', userId!);
        if (updateError) throw updateError;

        await logAdminAction({
          action: 'update',
          resourceType: 'users',
          resourceId: userId!,
          details: diff,
        });
      }

      // 회원가입 동적 필드 저장 (내부에서 자체 로그 기록)
      if (signupHasChanges) {
        const ok = await signupFieldsRef.current?.save();
        if (!ok) {
          setSavingBasic(false);
          return;
        }
      }

      setEditingBasic(false);
      await loadUser();
    } catch (err) {
      alert(err instanceof Error ? err.message : '기본 정보 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingBasic(false);
    }
  }

  function handleCancelBasic() {
    if (!userDetail) return;
    setBasicForm({ name: userDetail.name, phone: userDetail.phone });
    setEditingBasic(false);
  }

  // joy: 비밀번호 초기화 — A안: 재설정 메일 발송 + 로그 기록
  async function handleResetPassword() {
    if (!userDetail) return;
    if (!confirm(`${userDetail.email} 주소로 비밀번호 재설정 메일을 발송하시겠습니까?`)) return;
    try {
      setResettingPassword(true);
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(userDetail.email);
      if (resetError) throw resetError;

      await logAdminAction({
        action: 'password_reset',
        resourceType: 'users',
        resourceId: userId!,
        details: { method: 'reset_email', email: userDetail.email },
      });

      alert('비밀번호 재설정 메일이 발송되었습니다.');
    } catch (err) {
      alert(err instanceof Error ? err.message : '비밀번호 초기화 중 오류가 발생했습니다.');
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleChangeLevel() {
    if (!confirm(`등급을 ${selectedLevel}(으)로 변경하시겠습니까?`)) return;
    try {
      const supabase = createClient();
      // Find the level_id by name
      const { data: levelData, error: levelError } = await supabase
        .from('user_levels')
        .select('id')
        .eq('name', selectedLevel)
        .single();

      if (levelError || !levelData) throw new Error('등급을 찾을 수 없습니다.');

      const beforeLevel = userDetail?.level ?? '';
      const { error: updateError } = await supabase
        .from('users')
        .update({ level_id: levelData.id })
        .eq('id', userId!);

      if (updateError) throw updateError;
      await logAdminAction({
        action: 'change_level',
        resourceType: 'users',
        resourceId: userId!,
        details: { before: beforeLevel, after: selectedLevel },
      });
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
      const supabase = createClient();
      const actualAmount = pointAction === 'add' ? amount : -amount;

      // Get current points
      const { data: currentUser } = await supabase
        .from('users')
        .select('points')
        .eq('id', userId!)
        .single();

      const newBalance = (currentUser?.points || 0) + actualAmount;

      // Update user points
      const { error: updateError } = await supabase
        .from('users')
        .update({ points: newBalance })
        .eq('id', userId!);

      if (updateError) throw updateError;

      // Insert point history
      await supabase.from('user_points_history').insert({
        user_id: userId!,
        amount: actualAmount,
        balance: newBalance,
        type: pointAction === 'add' ? 'admin_add' : 'admin_subtract',
        description: pointReason || (pointAction === 'add' ? '관리자 지급' : '관리자 차감'),
      });

      await logAdminAction({
        action: 'adjust_points',
        resourceType: 'users',
        resourceId: userId!,
        details: {
          type: pointAction,
          amount: actualAmount,
          balance: newBalance,
          reason: pointReason || null,
        },
      });

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
      const supabase = createClient();
      const nextBlocked = !userDetail.isBlocked;
      const { error: updateError } = await supabase
        .from('users')
        .update({ is_blocked: nextBlocked })
        .eq('id', userId!);

      if (updateError) throw updateError;
      await logAdminAction({
        action: nextBlocked ? 'block' : 'unblock',
        resourceType: 'users',
        resourceId: userId!,
      });
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

      {/* joy: 권한 + 담당자 + 커스텀 필드 섹션 */}
      {userId && (
        <div className="mb-6 space-y-4">
          <UserPermissionSection userId={userId} />
          <UserManagersSection userId={userId} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 기본 정보 */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">기본 정보</h2>
            {!editingBasic && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingBasic(true)}>
                  수정
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResetPassword}
                  disabled={resettingPassword}
                >
                  {resettingPassword ? '발송 중...' : '비밀번호 초기화'}
                </Button>
              </div>
            )}
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-500 shrink-0">이름</dt>
              <dd className="font-medium text-right flex-1">
                {editingBasic ? (
                  <input
                    type="text"
                    value={basicForm.name}
                    onChange={(e) => setBasicForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  userDetail.name
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-500 shrink-0">이메일</dt>
              <dd className="text-right flex-1">{userDetail.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-gray-500 shrink-0">휴대폰번호</dt>
              <dd className="text-right flex-1">
                {editingBasic ? (
                  <input
                    type="tel"
                    value={basicForm.phone}
                    onChange={(e) => setBasicForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="010-0000-0000"
                  />
                ) : (
                  userDetail.phone || '-'
                )}
              </dd>
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

            {/* joy: 회원가입 필드 동적 표시 (기본 4개 제외한 활성 필드) */}
            {userId && (
              <div className="border-t pt-3 space-y-3">
                <UserSignupFieldsSection ref={signupFieldsRef} userId={userId} editing={editingBasic} />
              </div>
            )}
          </dl>

          {editingBasic && (
            <div className="mt-4 flex gap-2 border-t pt-4">
              <Button size="sm" onClick={handleSaveBasic} disabled={savingBasic}>
                {savingBasic ? '저장 중...' : '저장'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancelBasic} disabled={savingBasic}>
                취소
              </Button>
            </div>
          )}
        </Card>

        {/* 등급 및 포인트 */}
        {(useLevels || usePoints) && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">
            {useLevels && usePoints ? `등급 및 ${pointLabel}` : useLevels ? '등급' : pointLabel}
          </h2>
          {usePoints && (
          <div className="mb-4">
            <p className="mb-1 text-sm text-gray-500">현재 {pointLabel}</p>
            <p className="text-2xl font-bold">{(userDetail.points || 0).toLocaleString()}P</p>
          </div>
          )}

          {useLevels && (
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
          )}

          {usePoints && (
          <form onSubmit={handlePointSubmit}>
            <label className="mb-1 block text-sm font-medium text-gray-700">{pointLabel} 조정</label>
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
              placeholder={`${pointLabel} 금액`}
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
            <Button type="submit" className="w-full">{pointLabel} 처리</Button>
          </form>
          )}
        </Card>
        )}

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
