import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ArrowLeft, RefreshCw, X, Check, Search, Truck } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import {
  getAllRefundRequests,
  approveRefund,
  rejectRefund,
  completeRefund,
  updateReturnTracking,
  REFUND_REASONS,
  REFUND_TYPE_LABELS,
  REFUND_STATUS_LABELS,
  type RefundRequest,
  type RefundStatus,
} from '@/services/refund';
import {
  getAllReturnRequests,
  approveReturn,
  rejectReturn,
  updateReturnCollectTracking,
  completeReturn,
  RETURN_STATUS_LABELS,
  type ReturnRequest,
  type ReturnStatus,
} from '@/services/returns';
import {
  getAllExchangeRequests,
  approveExchange,
  rejectExchange,
  updateExchangeCollectTracking,
  updateExchangeReshipTracking,
  completeExchange,
  EXCHANGE_STATUS_LABELS,
  type ExchangeRequest,
  type ExchangeStatus,
} from '@/services/exchanges';

type TabType = 'refund' | 'return' | 'exchange';

interface ShippingCompany {
  id: string;
  name: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-800',
  approved:   'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  collected:  'bg-teal-100 text-teal-800',
  reshipped:  'bg-indigo-100 text-indigo-800',
  completed:  'bg-green-100 text-green-800',
  rejected:   'bg-red-100 text-red-800',
  cancelled:  'bg-gray-100 text-gray-700',
};

export default function AdminRefundsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<TabType>('refund');

  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [exchanges, setExchanges] = useState<ExchangeRequest[]>([]);
  const [shippingCompanies, setShippingCompanies] = useState<ShippingCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // 취소/환불 상세 모달
  const [detailRefund, setDetailRefund] = useState<RefundRequest | null>(null);
  const [actionMemo, setActionMemo] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [trackingInput, setTrackingInput] = useState('');

  // 반품 상세 모달
  const [detailReturn, setDetailReturn] = useState<ReturnRequest | null>(null);
  const [returnRejectReason, setReturnRejectReason] = useState('');
  const [returnCollectTracking, setReturnCollectTracking] = useState('');
  const [returnCollectCompany, setReturnCollectCompany] = useState('');
  const [returnMemo, setReturnMemo] = useState('');

  // 교환 상세 모달
  const [detailExchange, setDetailExchange] = useState<ExchangeRequest | null>(null);
  const [exchangeRejectReason, setExchangeRejectReason] = useState('');
  const [exchangeCollectTracking, setExchangeCollectTracking] = useState('');
  const [exchangeCollectCompany, setExchangeCollectCompany] = useState('');
  const [exchangeReshipTracking, setExchangeReshipTracking] = useState('');
  const [exchangeReshipCompany, setExchangeReshipCompany] = useState('');
  const [exchangeMemo, setExchangeMemo] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate('/auth/login'); return; }
      loadAll();
    }
  }, [user, authLoading]);

  async function loadAll() {
    setLoading(true);
    try {
      const supabase = createClient();
      const [refundData, returnData, exchangeData, companiesData] = await Promise.all([
        getAllRefundRequests(),
        getAllReturnRequests(),
        getAllExchangeRequests(),
        supabase.from('shipping_companies').select('id, name').eq('is_active', true).order('sort_order'),
      ]);
      setRefunds(refundData);
      setReturns(returnData);
      setExchanges(exchangeData);
      setShippingCompanies((companiesData.data ?? []).map((c: any) => ({ id: c.id, name: c.name })));
    } finally {
      setLoading(false);
    }
  }

  // ── 취소/환불 처리 ──────────────────────────────────────────────

  async function handleRefundApprove() {
    if (!detailRefund) return;
    setSaving(true);
    try {
      const result = await approveRefund(detailRefund.id, actionMemo || undefined);
      if (!result.success) throw new Error(result.error);
      await loadAll();
      setDetailRefund(null); setActionMemo('');
    } catch (e: any) { alert(e.message ?? '승인 처리 실패'); }
    finally { setSaving(false); }
  }

  async function handleRefundReject() {
    if (!detailRefund || !rejectReason.trim()) { alert('거부 사유를 입력해주세요.'); return; }
    setSaving(true);
    try {
      const result = await rejectRefund(detailRefund.id, rejectReason);
      if (!result.success) throw new Error(result.error);
      await loadAll();
      setDetailRefund(null); setRejectReason('');
    } catch (e: any) { alert(e.message ?? '거부 처리 실패'); }
    finally { setSaving(false); }
  }

  async function handleRefundComplete() {
    if (!detailRefund) return;
    if (!confirm('환불 완료 처리하시겠습니까? 재고·포인트·쿠폰이 자동으로 복구됩니다.')) return;
    setSaving(true);
    try {
      const result = await completeRefund(detailRefund.id, actionMemo || undefined, user?.id);
      if (!result.success) throw new Error(result.error);
      await loadAll();
      setDetailRefund(null); setActionMemo('');
    } catch (e: any) { alert(e.message ?? '완료 처리 실패'); }
    finally { setSaving(false); }
  }

  async function handleRefundTracking() {
    if (!detailRefund || !trackingInput.trim()) { alert('반품 운송장을 입력해주세요.'); return; }
    setSaving(true);
    try {
      const result = await updateReturnTracking(detailRefund.id, trackingInput.trim());
      if (!result.success) throw new Error(result.error);
      await loadAll();
      setTrackingInput('');
      alert('반품 운송장이 등록되었습니다.');
    } catch (e: any) { alert(e.message ?? '운송장 등록 실패'); }
    finally { setSaving(false); }
  }

  // ── 반품 처리 ───────────────────────────────────────────────────

  async function handleReturnApprove() {
    if (!detailReturn) return;
    setSaving(true);
    try {
      const result = await approveReturn(detailReturn.id, returnMemo || undefined);
      if (!result.success) throw new Error(result.error);
      await loadAll();
      const updated = (await getAllReturnRequests()).find((r) => r.id === detailReturn.id) ?? null;
      setDetailReturn(updated);
    } catch (e: any) { alert(e.message ?? '승인 처리 실패'); }
    finally { setSaving(false); }
  }

  async function handleReturnReject() {
    if (!detailReturn || !returnRejectReason.trim()) { alert('거부 사유를 입력해주세요.'); return; }
    setSaving(true);
    try {
      const result = await rejectReturn(detailReturn.id, returnRejectReason);
      if (!result.success) throw new Error(result.error);
      await loadAll();
      setDetailReturn(null); setReturnRejectReason('');
    } catch (e: any) { alert(e.message ?? '거부 처리 실패'); }
    finally { setSaving(false); }
  }

  async function handleReturnCollectTracking() {
    if (!detailReturn || !returnCollectTracking.trim()) { alert('수거 운송장 번호를 입력해주세요.'); return; }
    setSaving(true);
    try {
      const result = await updateReturnCollectTracking(
        detailReturn.id, returnCollectTracking.trim(), returnCollectCompany || undefined,
      );
      if (!result.success) throw new Error(result.error);
      await loadAll();
      const updated = (await getAllReturnRequests()).find((r) => r.id === detailReturn.id) ?? null;
      setDetailReturn(updated);
      setReturnCollectTracking(''); setReturnCollectCompany('');
      alert('수거 운송장이 등록되었습니다.');
    } catch (e: any) { alert(e.message ?? '운송장 등록 실패'); }
    finally { setSaving(false); }
  }

  async function handleReturnComplete() {
    if (!detailReturn) return;
    if (!confirm('반품 완료 처리하시겠습니까? 재고가 자동으로 복구됩니다.')) return;
    setSaving(true);
    try {
      const result = await completeReturn(detailReturn.id, returnMemo || undefined, user?.id);
      if (!result.success) throw new Error(result.error);
      await loadAll();
      setDetailReturn(null); setReturnMemo('');
    } catch (e: any) { alert(e.message ?? '완료 처리 실패'); }
    finally { setSaving(false); }
  }

  // ── 교환 처리 ───────────────────────────────────────────────────

  async function handleExchangeApprove() {
    if (!detailExchange) return;
    setSaving(true);
    try {
      const result = await approveExchange(detailExchange.id, exchangeMemo || undefined);
      if (!result.success) throw new Error(result.error);
      await loadAll();
      const updated = (await getAllExchangeRequests()).find((e) => e.id === detailExchange.id) ?? null;
      setDetailExchange(updated);
    } catch (e: any) { alert(e.message ?? '승인 처리 실패'); }
    finally { setSaving(false); }
  }

  async function handleExchangeReject() {
    if (!detailExchange || !exchangeRejectReason.trim()) { alert('거부 사유를 입력해주세요.'); return; }
    setSaving(true);
    try {
      const result = await rejectExchange(detailExchange.id, exchangeRejectReason);
      if (!result.success) throw new Error(result.error);
      await loadAll();
      setDetailExchange(null); setExchangeRejectReason('');
    } catch (e: any) { alert(e.message ?? '거부 처리 실패'); }
    finally { setSaving(false); }
  }

  async function handleExchangeCollectTracking() {
    if (!detailExchange || !exchangeCollectTracking.trim()) { alert('수거 운송장 번호를 입력해주세요.'); return; }
    setSaving(true);
    try {
      const result = await updateExchangeCollectTracking(
        detailExchange.id, exchangeCollectTracking.trim(), exchangeCollectCompany || undefined,
      );
      if (!result.success) throw new Error(result.error);
      await loadAll();
      const updated = (await getAllExchangeRequests()).find((e) => e.id === detailExchange.id) ?? null;
      setDetailExchange(updated);
      setExchangeCollectTracking(''); setExchangeCollectCompany('');
      alert('수거 운송장이 등록되었습니다.');
    } catch (e: any) { alert(e.message ?? '운송장 등록 실패'); }
    finally { setSaving(false); }
  }

  async function handleExchangeReshipTracking() {
    if (!detailExchange || !exchangeReshipTracking.trim()) { alert('재발송 운송장 번호를 입력해주세요.'); return; }
    setSaving(true);
    try {
      const result = await updateExchangeReshipTracking(
        detailExchange.id, exchangeReshipTracking.trim(), exchangeReshipCompany || undefined,
      );
      if (!result.success) throw new Error(result.error);
      await loadAll();
      const updated = (await getAllExchangeRequests()).find((e) => e.id === detailExchange.id) ?? null;
      setDetailExchange(updated);
      setExchangeReshipTracking(''); setExchangeReshipCompany('');
      alert('재발송 운송장이 등록되었습니다.');
    } catch (e: any) { alert(e.message ?? '운송장 등록 실패'); }
    finally { setSaving(false); }
  }

  async function handleExchangeComplete() {
    if (!detailExchange) return;
    if (!confirm('교환 완료 처리하시겠습니까? 원 상품 재고가 복구되고 교환 상품 재고가 차감됩니다.')) return;
    setSaving(true);
    try {
      const result = await completeExchange(detailExchange.id, exchangeMemo || undefined);
      if (!result.success) throw new Error(result.error);
      await loadAll();
      setDetailExchange(null); setExchangeMemo('');
    } catch (e: any) { alert(e.message ?? '완료 처리 실패'); }
    finally { setSaving(false); }
  }

  // ── 필터 ──────────────────────────────────────────────────────

  const filteredRefunds = refunds.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.orderNumber?.toLowerCase().includes(q) || r.customerName?.toLowerCase().includes(q);
  });

  const filteredReturns = returns.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.orderNumber.toLowerCase().includes(q) || r.customerName.toLowerCase().includes(q);
  });

  const filteredExchanges = exchanges.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.orderNumber.toLowerCase().includes(q) || e.customerName.toLowerCase().includes(q);
  });

  const TAB_COUNTS = {
    refund:   refunds.filter((r) => r.status === 'pending').length,
    return:   returns.filter((r) => r.status === 'pending').length,
    exchange: exchanges.filter((e) => e.status === 'pending').length,
  };

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <Link to="/admin" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />대시보드로 돌아가기
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">환불 / 반품 / 교환 관리</h1>
        <Button variant="outline" onClick={loadAll} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />새로고침
        </Button>
      </div>

      {/* 탭 */}
      <div className="mb-4 flex border-b">
        {(['refund', 'return', 'exchange'] as TabType[]).map((t) => {
          const labels: Record<TabType, string> = { refund: '취소/환불', return: '반품', exchange: '교환' };
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors relative ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {labels[t]}
              {TAB_COUNTS[t] > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-red-500 text-white text-xs px-1">
                  {TAB_COUNTS[t]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 검색 */}
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="주문번호 / 고객명 검색" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* ── 취소/환불 탭 ── */}
      {tab === 'refund' && (
        loading ? <div className="py-12 text-center text-gray-400">로딩 중...</div> :
        filteredRefunds.length === 0 ? (
          <Card className="p-12 text-center text-gray-500">환불 요청 내역이 없습니다.</Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">주문번호</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">고객명</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">유형</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">환불금액</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">사유</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">상태</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">신청일</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">처리</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRefunds.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link to={`/admin/orders/${r.orderId}`} className="font-mono text-blue-600 hover:underline">{r.orderNumber}</Link>
                      </td>
                      <td className="px-4 py-3">{r.customerName}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{REFUND_TYPE_LABELS[r.type]}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(r.amount)}</td>
                      <td className="px-4 py-3 max-w-xs"><p className="truncate">{REFUND_REASONS[r.reason] ?? r.reason}</p></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {REFUND_STATUS_LABELS[r.status as RefundStatus] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{format(new Date(r.createdAt), 'MM/dd HH:mm')}</td>
                      <td className="px-4 py-3 text-center">
                        <Button size="sm" variant="outline" onClick={() => { setDetailRefund(r); setActionMemo(r.adminMemo ?? ''); }}>
                          상세/처리
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {/* ── 반품 탭 ── */}
      {tab === 'return' && (
        loading ? <div className="py-12 text-center text-gray-400">로딩 중...</div> :
        filteredReturns.length === 0 ? (
          <Card className="p-12 text-center text-gray-500">반품 신청 내역이 없습니다.</Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">주문번호</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">고객명</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">상품</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">사유</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">수거 운송장</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">상태</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">신청일</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">처리</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredReturns.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link to={`/admin/orders/${r.orderId}`} className="font-mono text-blue-600 hover:underline">{r.orderNumber}</Link>
                      </td>
                      <td className="px-4 py-3">{r.customerName}</td>
                      <td className="px-4 py-3 max-w-[160px]"><p className="truncate text-xs text-gray-700">{r.itemSummary || '—'}</p></td>
                      <td className="px-4 py-3 max-w-xs"><p className="truncate">{r.reason}</p></td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.trackingNumber ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? 'bg-gray-100'}`}>
                          {RETURN_STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{format(new Date(r.createdAt), 'MM/dd HH:mm')}</td>
                      <td className="px-4 py-3 text-center">
                        <Button size="sm" variant="outline" onClick={() => { setDetailReturn(r); setReturnMemo(r.adminMemo ?? ''); }}>
                          상세/처리
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {/* ── 교환 탭 ── */}
      {tab === 'exchange' && (
        loading ? <div className="py-12 text-center text-gray-400">로딩 중...</div> :
        filteredExchanges.length === 0 ? (
          <Card className="p-12 text-center text-gray-500">교환 신청 내역이 없습니다.</Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">주문번호</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">고객명</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">상품</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">사유</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">수거 운송장</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">재발송 운송장</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">상태</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">신청일</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">처리</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredExchanges.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link to={`/admin/orders/${e.orderId}`} className="font-mono text-blue-600 hover:underline">{e.orderNumber}</Link>
                      </td>
                      <td className="px-4 py-3">{e.customerName}</td>
                      <td className="px-4 py-3 max-w-[160px]"><p className="truncate text-xs text-gray-700">{e.itemSummary || '—'}</p></td>
                      <td className="px-4 py-3 max-w-xs"><p className="truncate">{e.reason}</p></td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{e.trackingNumber ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{e.reshipTrackingNumber ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[e.status] ?? 'bg-gray-100'}`}>
                          {EXCHANGE_STATUS_LABELS[e.status] ?? e.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{format(new Date(e.createdAt), 'MM/dd HH:mm')}</td>
                      <td className="px-4 py-3 text-center">
                        <Button size="sm" variant="outline" onClick={() => { setDetailExchange(e); setExchangeMemo(e.adminMemo ?? ''); }}>
                          상세/처리
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {/* ── 취소/환불 상세 모달 ── */}
      {detailRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                환불 상세 — <span className="font-mono text-blue-600">{detailRefund.orderNumber}</span>
              </h2>
              <button onClick={() => { setDetailRefund(null); setActionMemo(''); setRejectReason(''); setTrackingInput(''); }}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg space-y-1.5">
                  <p className="font-medium text-gray-700 mb-2">신청 정보</p>
                  <div className="flex gap-2"><span className="text-gray-500 w-16">유형</span><span>{REFUND_TYPE_LABELS[detailRefund.type]}</span></div>
                  <div className="flex gap-2"><span className="text-gray-500 w-16">사유</span><span>{REFUND_REASONS[detailRefund.reason] ?? detailRefund.reason}</span></div>
                  {detailRefund.reasonDetail && <div className="flex gap-2"><span className="text-gray-500 w-16">상세</span><span className="break-words">{detailRefund.reasonDetail}</span></div>}
                  <div className="flex gap-2"><span className="text-gray-500 w-16">신청일</span><span>{format(new Date(detailRefund.createdAt), 'yyyy-MM-dd HH:mm')}</span></div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg space-y-1.5">
                  <p className="font-medium text-gray-700 mb-2">금액 / 상태</p>
                  <div className="flex gap-2"><span className="text-gray-500 w-16">환불금액</span><span className="font-bold">{formatCurrency(detailRefund.amount)}</span></div>
                  <div className="flex gap-2"><span className="text-gray-500 w-16">상태</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[detailRefund.status] ?? 'bg-gray-100'}`}>
                      {REFUND_STATUS_LABELS[detailRefund.status as RefundStatus]}
                    </span>
                  </div>
                </div>
              </div>

              {detailRefund.items.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">환불 대상 상품</p>
                  <div className="rounded-lg border divide-y text-sm">
                    {detailRefund.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2.5">
                        <span>{item.productName} {item.variantInfo && <span className="text-gray-400">({item.variantInfo})</span>}</span>
                        <span className="text-gray-500">{item.quantity}개 · {formatCurrency(item.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(detailRefund.bankName || detailRefund.bankAccount) && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                  <p className="font-medium text-blue-800 mb-2">환불 계좌 (무통장)</p>
                  <div className="space-y-1">
                    <div className="flex gap-2"><span className="text-blue-600 w-16">은행</span><span>{detailRefund.bankName}</span></div>
                    <div className="flex gap-2"><span className="text-blue-600 w-16">계좌번호</span><span className="font-mono">{detailRefund.bankAccount}</span></div>
                    <div className="flex gap-2"><span className="text-blue-600 w-16">예금주</span><span>{detailRefund.accountHolder}</span></div>
                  </div>
                </div>
              )}

              {detailRefund.type === 'return' && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">반품 회수 운송장</p>
                  {detailRefund.trackingNumber ? (
                    <p className="text-sm font-mono bg-gray-50 rounded px-3 py-2">{detailRefund.trackingNumber}</p>
                  ) : (
                    <div className="flex gap-2">
                      <Input value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)} placeholder="반품 운송장 번호 입력" />
                      <Button onClick={handleRefundTracking} disabled={saving || !trackingInput.trim()}>등록</Button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">관리자 메모</label>
                <textarea value={actionMemo} onChange={(e) => setActionMemo(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 p-2.5 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="처리 메모 (선택)" />
              </div>

              <div className="border-t pt-4">
                {detailRefund.status === 'pending' && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={handleRefundApprove} disabled={saving}><Check className="mr-2 h-4 w-4" />승인</Button>
                      <Button variant="destructive" className="flex-1" onClick={() => { if (!rejectReason.trim()) { alert('거부 사유를 입력해주세요.'); return; } handleRefundReject(); }} disabled={saving}>거부</Button>
                    </div>
                    <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="거부 사유 (거부 시 필수)" />
                  </div>
                )}
                {detailRefund.status === 'approved' && (
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleRefundComplete} disabled={saving}>
                    <Check className="mr-2 h-4 w-4" />환불 완료 처리 (재고·포인트·쿠폰 자동 복구)
                  </Button>
                )}
                {detailRefund.status === 'processing' && (
                  <div className="rounded-lg bg-purple-50 p-3 text-sm text-purple-700">
                    무통장 이체 완료 후 "환불 완료 처리" 버튼을 클릭하세요.
                    <Button className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleRefundComplete} disabled={saving}>환불 완료 처리</Button>
                  </div>
                )}
                {['completed', 'rejected', 'cancelled'].includes(detailRefund.status) && (
                  <p className="text-center text-sm text-gray-400">처리가 완료된 요청입니다.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── 반품 상세 모달 ── */}
      {detailReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                반품 처리 — <span className="font-mono text-blue-600">{detailReturn.orderNumber}</span>
              </h2>
              <button onClick={() => { setDetailReturn(null); setReturnRejectReason(''); setReturnCollectTracking(''); setReturnMemo(''); }}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* 기본 정보 */}
              <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1.5">
                <div className="flex gap-2"><span className="text-gray-500 w-16">고객</span><span className="font-medium">{detailReturn.customerName}</span></div>
                <div className="flex gap-2"><span className="text-gray-500 w-16">사유</span><span>{detailReturn.reason}</span></div>
                {detailReturn.description && <div className="flex gap-2"><span className="text-gray-500 w-16">상세</span><span className="break-words">{detailReturn.description}</span></div>}
                <div className="flex gap-2"><span className="text-gray-500 w-16">상태</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[detailReturn.status] ?? 'bg-gray-100'}`}>
                    {RETURN_STATUS_LABELS[detailReturn.status] ?? detailReturn.status}
                  </span>
                </div>
                <div className="flex gap-2"><span className="text-gray-500 w-16">신청일</span><span>{format(new Date(detailReturn.createdAt), 'yyyy-MM-dd HH:mm')}</span></div>
              </div>

              {/* 수거 운송장 표시 */}
              {detailReturn.trackingNumber && (
                <div className="p-3 bg-teal-50 rounded-lg text-sm">
                  <p className="font-medium text-teal-800 mb-1 flex items-center gap-1"><Truck className="h-3.5 w-3.5" />수거 운송장</p>
                  <p className="font-mono">{detailReturn.trackingNumber}</p>
                  {detailReturn.collectedAt && <p className="text-teal-600 text-xs mt-1">수거완료: {format(new Date(detailReturn.collectedAt), 'MM/dd HH:mm')}</p>}
                </div>
              )}

              {/* 관리자 메모 */}
              <div>
                <label className="text-sm font-medium text-gray-700">관리자 메모</label>
                <textarea value={returnMemo} onChange={(e) => setReturnMemo(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 p-2.5 text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="처리 메모 (선택)" />
              </div>

              {/* 상태별 액션 */}
              <div className="border-t pt-4 space-y-3">
                {/* pending: 승인 / 거부 */}
                {detailReturn.status === 'pending' && (
                  <>
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={handleReturnApprove} disabled={saving}><Check className="mr-2 h-4 w-4" />승인</Button>
                      <Button variant="destructive" className="flex-1" onClick={() => { if (!returnRejectReason.trim()) { alert('거부 사유를 입력해주세요.'); return; } handleReturnReject(); }} disabled={saving}>거부</Button>
                    </div>
                    <Input value={returnRejectReason} onChange={(e) => setReturnRejectReason(e.target.value)} placeholder="거부 사유 (거부 시 필수)" />
                  </>
                )}

                {/* approved: 수거 운송장 입력 */}
                {detailReturn.status === 'approved' && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">수거 운송장 등록</p>
                    <Select value={returnCollectCompany} onValueChange={setReturnCollectCompany}>
                      <SelectTrigger><SelectValue placeholder="수거 택배사 선택 (선택)" /></SelectTrigger>
                      <SelectContent>
                        {shippingCompanies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Input value={returnCollectTracking} onChange={(e) => setReturnCollectTracking(e.target.value)} placeholder="수거 운송장 번호" />
                      <Button onClick={handleReturnCollectTracking} disabled={saving || !returnCollectTracking.trim()}>등록</Button>
                    </div>
                  </div>
                )}

                {/* collected: 반품 완료 처리 */}
                {detailReturn.status === 'collected' && (
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleReturnComplete} disabled={saving}>
                    <Check className="mr-2 h-4 w-4" />반품 완료 처리 (재고 자동 복구)
                  </Button>
                )}

                {['completed', 'rejected'].includes(detailReturn.status) && (
                  <p className="text-center text-sm text-gray-400">처리가 완료된 요청입니다.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── 교환 상세 모달 ── */}
      {detailExchange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                교환 처리 — <span className="font-mono text-blue-600">{detailExchange.orderNumber}</span>
              </h2>
              <button onClick={() => { setDetailExchange(null); setExchangeRejectReason(''); setExchangeCollectTracking(''); setExchangeReshipTracking(''); setExchangeMemo(''); }}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* 기본 정보 */}
              <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1.5">
                <div className="flex gap-2"><span className="text-gray-500 w-16">고객</span><span className="font-medium">{detailExchange.customerName}</span></div>
                <div className="flex gap-2"><span className="text-gray-500 w-16">사유</span><span>{detailExchange.reason}</span></div>
                <div className="flex gap-2"><span className="text-gray-500 w-16">상태</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[detailExchange.status] ?? 'bg-gray-100'}`}>
                    {EXCHANGE_STATUS_LABELS[detailExchange.status] ?? detailExchange.status}
                  </span>
                </div>
                <div className="flex gap-2"><span className="text-gray-500 w-16">신청일</span><span>{format(new Date(detailExchange.createdAt), 'yyyy-MM-dd HH:mm')}</span></div>
              </div>

              {/* 운송장 현황 */}
              {(detailExchange.trackingNumber || detailExchange.reshipTrackingNumber) && (
                <div className="space-y-2">
                  {detailExchange.trackingNumber && (
                    <div className="p-3 bg-teal-50 rounded-lg text-sm">
                      <p className="font-medium text-teal-800 mb-1 flex items-center gap-1"><Truck className="h-3.5 w-3.5" />수거 운송장</p>
                      <p className="font-mono">{detailExchange.trackingNumber}</p>
                      {detailExchange.collectedAt && <p className="text-teal-600 text-xs mt-1">수거완료: {format(new Date(detailExchange.collectedAt), 'MM/dd HH:mm')}</p>}
                    </div>
                  )}
                  {detailExchange.reshipTrackingNumber && (
                    <div className="p-3 bg-indigo-50 rounded-lg text-sm">
                      <p className="font-medium text-indigo-800 mb-1 flex items-center gap-1"><Truck className="h-3.5 w-3.5" />재발송 운송장</p>
                      <p className="font-mono">{detailExchange.reshipTrackingNumber}</p>
                      {detailExchange.reshippedAt && <p className="text-indigo-600 text-xs mt-1">재발송: {format(new Date(detailExchange.reshippedAt), 'MM/dd HH:mm')}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* 관리자 메모 */}
              <div>
                <label className="text-sm font-medium text-gray-700">관리자 메모</label>
                <textarea value={exchangeMemo} onChange={(e) => setExchangeMemo(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 p-2.5 text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="처리 메모 (선택)" />
              </div>

              {/* 상태별 액션 */}
              <div className="border-t pt-4 space-y-3">
                {/* pending: 승인 / 거부 */}
                {detailExchange.status === 'pending' && (
                  <>
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={handleExchangeApprove} disabled={saving}><Check className="mr-2 h-4 w-4" />승인</Button>
                      <Button variant="destructive" className="flex-1" onClick={() => { if (!exchangeRejectReason.trim()) { alert('거부 사유를 입력해주세요.'); return; } handleExchangeReject(); }} disabled={saving}>거부</Button>
                    </div>
                    <Input value={exchangeRejectReason} onChange={(e) => setExchangeRejectReason(e.target.value)} placeholder="거부 사유 (거부 시 필수)" />
                  </>
                )}

                {/* approved: 수거 운송장 입력 */}
                {detailExchange.status === 'approved' && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">수거 운송장 등록</p>
                    <Select value={exchangeCollectCompany} onValueChange={setExchangeCollectCompany}>
                      <SelectTrigger><SelectValue placeholder="수거 택배사 선택 (선택)" /></SelectTrigger>
                      <SelectContent>
                        {shippingCompanies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Input value={exchangeCollectTracking} onChange={(e) => setExchangeCollectTracking(e.target.value)} placeholder="수거 운송장 번호" />
                      <Button onClick={handleExchangeCollectTracking} disabled={saving || !exchangeCollectTracking.trim()}>등록</Button>
                    </div>
                  </div>
                )}

                {/* collected: 재발송 운송장 입력 */}
                {detailExchange.status === 'collected' && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">재발송 운송장 등록</p>
                    <Select value={exchangeReshipCompany} onValueChange={setExchangeReshipCompany}>
                      <SelectTrigger><SelectValue placeholder="재발송 택배사 선택 (선택)" /></SelectTrigger>
                      <SelectContent>
                        {shippingCompanies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Input value={exchangeReshipTracking} onChange={(e) => setExchangeReshipTracking(e.target.value)} placeholder="재발송 운송장 번호" />
                      <Button onClick={handleExchangeReshipTracking} disabled={saving || !exchangeReshipTracking.trim()}>등록</Button>
                    </div>
                  </div>
                )}

                {/* reshipped: 교환 완료 처리 */}
                {detailExchange.status === 'reshipped' && (
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleExchangeComplete} disabled={saving}>
                    <Check className="mr-2 h-4 w-4" />교환 완료 처리 (재고 자동 복구·차감)
                  </Button>
                )}

                {['completed', 'rejected'].includes(detailExchange.status) && (
                  <p className="text-center text-sm text-gray-400">처리가 완료된 요청입니다.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
