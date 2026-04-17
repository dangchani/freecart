import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ArrowLeft, RefreshCw, X, Check, Search, Truck, Package } from 'lucide-react';
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
  completeReturn,
  updateReturnTracking,
  requestReturnPickup,
  REFUND_REASONS,
  REFUND_TYPE_LABELS,
  REFUND_STATUS_LABELS,
  type RefundRequest,
  type RefundStatus,
} from '@/services/refund';
import {
  getAllExchangeRequests,
  approveExchange,
  rejectExchange,
  updateExchangeCollectTracking,
  updateExchangeReshipTracking,
  completeExchange,
  requestExchangePickup,
  EXCHANGE_STATUS_LABELS,
  type ExchangeRequest,
  type ExchangeStatus,
} from '@/services/exchanges';

type TabType = 'refund' | 'exchange';

interface ShippingCompany {
  id: string;
  name: string;
}

interface GfCenter {
  centerCode: string;
  centerName: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending:          'bg-yellow-100 text-yellow-800',
  approved:         'bg-blue-100 text-blue-800',
  processing:       'bg-purple-100 text-purple-800',
  pickup_requested: 'bg-orange-100 text-orange-800',
  collected:        'bg-teal-100 text-teal-800',
  reshipped:        'bg-indigo-100 text-indigo-800',
  completed:        'bg-green-100 text-green-800',
  rejected:         'bg-red-100 text-red-800',
  cancelled:        'bg-gray-100 text-gray-700',
};

const REFUND_STATUS_LABELS_EXTENDED: Record<string, string> = {
  ...REFUND_STATUS_LABELS,
  pickup_requested: '픽업요청',
};

export default function AdminRefundsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<TabType>('refund');

  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [exchanges, setExchanges] = useState<ExchangeRequest[]>([]);
  const [shippingCompanies, setShippingCompanies] = useState<ShippingCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // GoodFlow 연동 상태
  const [gfConnected, setGfConnected] = useState(false);
  const [gfCenters, setGfCenters] = useState<GfCenter[]>([]);

  // 환불 상세 모달
  const [detailRefund, setDetailRefund] = useState<RefundRequest | null>(null);
  const [actionMemo, setActionMemo] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [trackingInput, setTrackingInput] = useState('');
  const [trackingCompany, setTrackingCompany] = useState('');

  // GF 픽업 요청 모달
  const [showGfPickupModal, setShowGfPickupModal] = useState(false);
  const [gfPickupTarget, setGfPickupTarget] = useState<{ id: string; type: 'refund' | 'exchange' } | null>(null);
  const [gfCenterCode, setGfCenterCode] = useState('');
  const [gfTransporter, setGfTransporter] = useState('KOREX');
  const [gfBoxSize, setGfBoxSize] = useState('SMALL');
  const [gfPickupDate, setGfPickupDate] = useState('');
  const [gfPickupName, setGfPickupName] = useState('');
  const [gfPickupPhone, setGfPickupPhone] = useState('');
  const [gfPickupAddr1, setGfPickupAddr1] = useState('');
  const [gfPickupAddr2, setGfPickupAddr2] = useState('');
  const [gfPickupZip, setGfPickupZip] = useState('');
  const [gfItemName, setGfItemName] = useState('');
  const [gfPickupLoading, setGfPickupLoading] = useState(false);

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
      const [refundData, exchangeData, companiesData, gfData] = await Promise.all([
        getAllRefundRequests(),   // 모든 타입 (refund + return) 포함
        getAllExchangeRequests(),
        supabase.from('shipping_companies').select('id, name').eq('is_active', true).order('sort_order'),
        supabase.from('external_connections').select('is_active, credentials').eq('platform', 'goodsflow').maybeSingle(),
      ]);
      setRefunds(refundData);
      setExchanges(exchangeData);
      setShippingCompanies((companiesData.data ?? []).map((c: any) => ({ id: c.id, name: c.name })));

      const gfActive = gfData.data?.is_active === true;
      setGfConnected(gfActive);

      if (gfActive) {
        // 굿스플로 센터 목록 로드
        const { data: centersData } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'gf_centers_prod')
          .maybeSingle();
        const testData = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'gf_centers_test')
          .maybeSingle();
        const creds = gfData.data?.credentials as any;
        const useTest = creds?.use_test === 'true' || creds?.use_test === true;
        const centers: any[] = (useTest ? testData.data?.value : centersData?.value) ?? [];
        setGfCenters(centers.map((c: any) => ({ centerCode: c.centerCode, centerName: c.centerName })));
        if (centers.length > 0) setGfCenterCode(centers[0].centerCode);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── 환불 처리 ──────────────────────────────────────────────

  async function handleRefundApprove() {
    if (!detailRefund) return;
    setSaving(true);
    try {
      const result = await approveRefund(detailRefund.id, actionMemo || undefined);
      if (!result.success) throw new Error(result.error);
      await loadAll();
      const updated = (await getAllRefundRequests()).find((r) => r.id === detailRefund.id) ?? null;
      setDetailRefund(updated);
      setActionMemo('');
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
      // type='return': completeReturn (collected 상태 필요)
      // type='refund': completeRefund (approved 상태에서 가능)
      const result = detailRefund.type === 'return'
        ? await completeReturn(detailRefund.id, actionMemo || undefined, user?.id)
        : await completeRefund(detailRefund.id, actionMemo || undefined, user?.id);
      if (!result.success) throw new Error(result.error);
      await loadAll();
      setDetailRefund(null); setActionMemo('');
    } catch (e: any) { alert(e.message ?? '완료 처리 실패'); }
    finally { setSaving(false); }
  }

  async function handleReturnTracking() {
    if (!detailRefund || !trackingInput.trim()) { alert('수거 운송장 번호를 입력해주세요.'); return; }
    setSaving(true);
    try {
      const result = await updateReturnTracking(detailRefund.id, trackingInput.trim(), trackingCompany || undefined);
      if (!result.success) throw new Error(result.error);
      await loadAll();
      const updated = (await getAllRefundRequests()).find((r) => r.id === detailRefund.id) ?? null;
      setDetailRefund(updated);
      setTrackingInput(''); setTrackingCompany('');
      alert('수거 운송장이 등록되었습니다.');
    } catch (e: any) { alert(e.message ?? '운송장 등록 실패'); }
    finally { setSaving(false); }
  }

  // ── 굿스플로 픽업 요청 ──────────────────────────────────────

  function openGfPickupModal(id: string, type: 'refund' | 'exchange') {
    setGfPickupTarget({ id, type });
    setGfPickupName(''); setGfPickupPhone(''); setGfPickupAddr1('');
    setGfPickupAddr2(''); setGfPickupZip(''); setGfItemName(''); setGfPickupDate('');
    setShowGfPickupModal(true);
  }

  async function handleGfPickupSubmit() {
    if (!gfPickupTarget || !gfCenterCode) { alert('센터를 선택해주세요.'); return; }
    if (!gfPickupName || !gfPickupPhone || !gfPickupAddr1 || !gfPickupZip) {
      alert('고객 주소 정보를 모두 입력해주세요.'); return;
    }
    setGfPickupLoading(true);
    try {
      // 주문 정보에서 orderNumber, orderId 조회
      let orderNumber = '';
      let orderId = '';
      if (gfPickupTarget.type === 'refund') {
        const r = refunds.find((x) => x.id === gfPickupTarget.id);
        orderNumber = r?.orderNumber ?? '';
        orderId = r?.orderId ?? '';
      } else {
        const e = exchanges.find((x) => x.id === gfPickupTarget.id);
        orderNumber = e?.orderNumber ?? '';
        orderId = e?.orderId ?? '';
      }

      const params = {
        centerCode: gfCenterCode,
        transporter: gfTransporter,
        boxSize: gfBoxSize,
        pickupScheduledDate: gfPickupDate || undefined,
        fromName: gfPickupName,
        fromPhoneNo: gfPickupPhone,
        fromAddress1: gfPickupAddr1,
        fromAddress2: gfPickupAddr2,
        fromZipcode: gfPickupZip,
        itemName: gfItemName || '반송 상품',
        quantity: 1,
        orderNumber,
        orderId,
      };

      const result = gfPickupTarget.type === 'refund'
        ? await requestReturnPickup({ ...params, refundId: gfPickupTarget.id })
        : await requestExchangePickup({ ...params, exchangeId: gfPickupTarget.id });

      if (!result.success) throw new Error(result.error);

      alert(`굿스플로 픽업 요청 완료!\n반송 운송장: ${result.trackingNumber ?? '발급 대기'}`);
      setShowGfPickupModal(false);
      await loadAll();
      if (gfPickupTarget.type === 'refund') {
        const updated = (await getAllRefundRequests()).find((r) => r.id === gfPickupTarget.id) ?? null;
        setDetailRefund(updated);
      } else {
        const updated = (await getAllExchangeRequests()).find((e) => e.id === gfPickupTarget.id) ?? null;
        setDetailExchange(updated);
      }
    } catch (e: any) {
      alert(`픽업 요청 실패: ${e.message ?? '오류 발생'}`);
    } finally {
      setGfPickupLoading(false);
    }
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

  const filteredExchanges = exchanges.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.orderNumber.toLowerCase().includes(q) || e.customerName.toLowerCase().includes(q);
  });

  const TAB_COUNTS = {
    refund:   refunds.filter((r) => r.status === 'pending').length,
    exchange: exchanges.filter((e) => e.status === 'pending').length,
  };

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <Link to="/admin" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />대시보드로 돌아가기
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">환불 / 교환 관리</h1>
        <Button variant="outline" onClick={loadAll} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />새로고침
        </Button>
      </div>

      {/* 탭 */}
      <div className="mb-4 flex border-b">
        {(['refund', 'exchange'] as TabType[]).map((t) => {
          const labels: Record<TabType, string> = { refund: '환불', exchange: '교환' };
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

      {/* ── 환불 탭 ── */}
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
                    <th className="px-4 py-3 text-left font-medium text-gray-600">반송 운송장</th>
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
                        <span className={`rounded-full px-2 py-0.5 text-xs ${r.type === 'return' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>
                          {r.type === 'return' ? '환불(반송)' : REFUND_TYPE_LABELS[r.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(r.amount)}</td>
                      <td className="px-4 py-3 max-w-xs"><p className="truncate">{REFUND_REASONS[r.reason] ?? r.reason}</p></td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        {r.returnTrackingNumber ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {REFUND_STATUS_LABELS_EXTENDED[r.status as RefundStatus] ?? r.status}
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

      {/* ── 환불 상세 모달 ── */}
      {detailRefund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                환불 상세 — <span className="font-mono text-blue-600">{detailRefund.orderNumber}</span>
                {detailRefund.type === 'return' && (
                  <span className="ml-2 text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">상품반송 필요</span>
                )}
              </h2>
              <button onClick={() => { setDetailRefund(null); setActionMemo(''); setRejectReason(''); setTrackingInput(''); setTrackingCompany(''); }}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg space-y-1.5">
                  <p className="font-medium text-gray-700 mb-2">신청 정보</p>
                  <div className="flex gap-2"><span className="text-gray-500 w-16">유형</span><span>{detailRefund.type === 'return' ? '환불 (상품반송)' : REFUND_TYPE_LABELS[detailRefund.type]}</span></div>
                  <div className="flex gap-2"><span className="text-gray-500 w-16">신청자</span><span>{detailRefund.initiatedBy === 'admin' ? '관리자' : '고객'}</span></div>
                  <div className="flex gap-2"><span className="text-gray-500 w-16">사유</span><span>{REFUND_REASONS[detailRefund.reason] ?? detailRefund.reason}</span></div>
                  {detailRefund.reasonDetail && <div className="flex gap-2"><span className="text-gray-500 w-16">상세</span><span className="break-words">{detailRefund.reasonDetail}</span></div>}
                  <div className="flex gap-2"><span className="text-gray-500 w-16">신청일</span><span>{format(new Date(detailRefund.createdAt), 'yyyy-MM-dd HH:mm')}</span></div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg space-y-1.5">
                  <p className="font-medium text-gray-700 mb-2">금액 / 상태</p>
                  <div className="flex gap-2"><span className="text-gray-500 w-16">환불금액</span><span className="font-bold">{formatCurrency(detailRefund.amount)}</span></div>
                  <div className="flex gap-2"><span className="text-gray-500 w-16">상태</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[detailRefund.status] ?? 'bg-gray-100'}`}>
                      {REFUND_STATUS_LABELS_EXTENDED[detailRefund.status as RefundStatus] ?? detailRefund.status}
                    </span>
                  </div>
                  {detailRefund.approvedAt && <div className="flex gap-2"><span className="text-gray-500 w-16">승인일</span><span>{format(new Date(detailRefund.approvedAt), 'MM/dd HH:mm')}</span></div>}
                  {detailRefund.collectedAt && <div className="flex gap-2"><span className="text-gray-500 w-16">수거일</span><span>{format(new Date(detailRefund.collectedAt), 'MM/dd HH:mm')}</span></div>}
                </div>
              </div>

              {/* 환불 대상 상품 */}
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

              {/* 무통장 환불 계좌 */}
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

              {/* 반송 운송장 정보 (type='return') */}
              {detailRefund.type === 'return' && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                    <Truck className="h-4 w-4" />반송 운송장
                  </p>
                  {detailRefund.returnTrackingNumber ? (
                    <div className="p-3 bg-teal-50 rounded-lg text-sm">
                      <p className="font-mono text-teal-800">{detailRefund.returnTrackingNumber}</p>
                      {detailRefund.gfReturnServiceId && (
                        <p className="text-xs text-teal-600 mt-1">굿스플로 서비스ID: {detailRefund.gfReturnServiceId}</p>
                      )}
                      {detailRefund.pickupRequestedAt && (
                        <p className="text-xs text-teal-600 mt-0.5">픽업요청: {format(new Date(detailRefund.pickupRequestedAt), 'MM/dd HH:mm')}</p>
                      )}
                    </div>
                  ) : detailRefund.gfReturnServiceId ? (
                    <div className="p-3 bg-orange-50 rounded-lg text-sm">
                      <p className="text-orange-700">굿스플로 픽업 요청됨 — 운송장 발급 대기 중</p>
                      <p className="text-xs text-orange-500 mt-1">서비스ID: {detailRefund.gfReturnServiceId}</p>
                    </div>
                  ) : null}
                </div>
              )}

              {/* 관리자 메모 */}
              <div>
                <label className="text-sm font-medium text-gray-700">관리자 메모</label>
                <textarea value={actionMemo} onChange={(e) => setActionMemo(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 p-2.5 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="처리 메모 (선택)" />
              </div>

              {/* 상태별 액션 */}
              <div className="border-t pt-4 space-y-3">
                {/* pending: 승인 / 거부 */}
                {detailRefund.status === 'pending' && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={handleRefundApprove} disabled={saving}><Check className="mr-2 h-4 w-4" />승인</Button>
                      <Button variant="destructive" className="flex-1" onClick={() => { if (!rejectReason.trim()) { alert('거부 사유를 입력해주세요.'); return; } handleRefundReject(); }} disabled={saving}>거부</Button>
                    </div>
                    <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="거부 사유 (거부 시 필수)" />
                  </div>
                )}

                {/* approved: type='refund' → 환불 완료 / type='return' → 반송 픽업 요청 또는 운송장 입력 */}
                {detailRefund.status === 'approved' && detailRefund.type === 'refund' && (
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleRefundComplete} disabled={saving}>
                    <Check className="mr-2 h-4 w-4" />환불 완료 처리 (재고·포인트·쿠폰 자동 복구)
                  </Button>
                )}

                {detailRefund.status === 'approved' && detailRefund.type === 'return' && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700">반송 수거 처리</p>
                    {gfConnected ? (
                      <Button
                        variant="outline"
                        className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                        onClick={() => openGfPickupModal(detailRefund.id, 'refund')}
                        disabled={saving}
                      >
                        <Package className="mr-2 h-4 w-4" />굿스플로 반송 픽업 요청 (자동 운송장)
                      </Button>
                    ) : null}
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">{gfConnected ? '또는 수동 입력:' : '수거 운송장 직접 입력:'}</p>
                      <Select value={trackingCompany} onValueChange={setTrackingCompany}>
                        <SelectTrigger><SelectValue placeholder="수거 택배사 선택 (선택)" /></SelectTrigger>
                        <SelectContent>
                          {shippingCompanies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Input value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)} placeholder="수거 운송장 번호" />
                        <Button onClick={handleReturnTracking} disabled={saving || !trackingInput.trim()}>수거확인</Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* pickup_requested: GF 처리 대기 중 */}
                {detailRefund.status === 'pickup_requested' && (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-orange-50 p-3 text-sm text-orange-700">
                      굿스플로 픽업 진행 중 — 상품 수거 완료 후 자동으로 "수거완료" 상태로 변경됩니다.
                    </div>
                    <p className="text-xs text-gray-500">수거가 완료되었는데 상태가 변경되지 않은 경우:</p>
                    <div className="flex gap-2">
                      <Input value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)} placeholder="운송장 번호 (수동 확인)" />
                      <Button onClick={handleReturnTracking} disabled={saving || !trackingInput.trim()}>수거확인</Button>
                    </div>
                  </div>
                )}

                {/* collected (type='return'): 환불 완료 처리 */}
                {detailRefund.status === 'collected' && detailRefund.type === 'return' && (
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleRefundComplete} disabled={saving}>
                    <Check className="mr-2 h-4 w-4" />환불 완료 처리 (재고 자동 복구)
                  </Button>
                )}

                {/* processing: 무통장 처리 대기 */}
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
                <div className="flex gap-2"><span className="text-gray-500 w-16">신청자</span><span>{detailExchange.initiatedBy === 'admin' ? '관리자' : '고객'}</span></div>
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

                {/* approved: 수거 처리 (GF 픽업 또는 수동) */}
                {detailExchange.status === 'approved' && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700">반송 수거 처리</p>
                    {gfConnected ? (
                      <Button
                        variant="outline"
                        className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                        onClick={() => openGfPickupModal(detailExchange.id, 'exchange')}
                        disabled={saving}
                      >
                        <Package className="mr-2 h-4 w-4" />굿스플로 반송 픽업 요청 (자동 운송장)
                      </Button>
                    ) : null}
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500">{gfConnected ? '또는 수동 입력:' : '수거 운송장 직접 입력:'}</p>
                      <Select value={exchangeCollectCompany} onValueChange={setExchangeCollectCompany}>
                        <SelectTrigger><SelectValue placeholder="수거 택배사 선택 (선택)" /></SelectTrigger>
                        <SelectContent>
                          {shippingCompanies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Input value={exchangeCollectTracking} onChange={(e) => setExchangeCollectTracking(e.target.value)} placeholder="수거 운송장 번호" />
                        <Button onClick={handleExchangeCollectTracking} disabled={saving || !exchangeCollectTracking.trim()}>수거확인</Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* pickup_requested (exchange): GF 픽업 대기 */}
                {detailExchange.status === 'pickup_requested' && (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-orange-50 p-3 text-sm text-orange-700">
                      굿스플로 픽업 진행 중 — 상품 수거 완료 후 자동으로 "수거완료" 상태로 변경됩니다.
                    </div>
                    <p className="text-xs text-gray-500">수거가 완료된 경우 수동 처리:</p>
                    <Select value={exchangeCollectCompany} onValueChange={setExchangeCollectCompany}>
                      <SelectTrigger><SelectValue placeholder="수거 택배사 선택 (선택)" /></SelectTrigger>
                      <SelectContent>
                        {shippingCompanies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Input value={exchangeCollectTracking} onChange={(e) => setExchangeCollectTracking(e.target.value)} placeholder="운송장 번호" />
                      <Button onClick={handleExchangeCollectTracking} disabled={saving || !exchangeCollectTracking.trim()}>수거확인</Button>
                    </div>
                  </div>
                )}

                {/* collected: 재발송 운송장 입력 */}
                {detailExchange.status === 'collected' && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">재발송 운송장 등록 (새 상품 발송)</p>
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

      {/* ── 굿스플로 픽업 요청 모달 ── */}
      {showGfPickupModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-600" />굿스플로 반송 픽업 요청
              </h2>
              <button onClick={() => setShowGfPickupModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <p className="text-gray-500">고객 주소지에서 상품을 픽업합니다. 고객 정보를 입력해주세요.</p>

              {/* 센터 선택 */}
              <div>
                <label className="font-medium text-gray-700 mb-1 block">출고지(센터) 선택</label>
                <Select value={gfCenterCode} onValueChange={setGfCenterCode}>
                  <SelectTrigger><SelectValue placeholder="센터 선택" /></SelectTrigger>
                  <SelectContent>
                    {gfCenters.map((c) => <SelectItem key={c.centerCode} value={c.centerCode}>{c.centerName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* 택배사 + 박스 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-gray-700 mb-1 block">택배사</label>
                  <Select value={gfTransporter} onValueChange={setGfTransporter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[['KOREX','CJ대한통운'],['HANJIN','한진택배'],['LOTTE','롯데택배'],['EPOST','우체국'],['LOGEN','로젠'],['KDEXP','경동택배']].map(([v,l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-medium text-gray-700 mb-1 block">박스 크기</label>
                  <Select value={gfBoxSize} onValueChange={setGfBoxSize}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[['SMALL','소'],['MEDIUM','중'],['LARGE','대'],['XLARGE','특대']].map(([v,l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 픽업 예약일 */}
              <div>
                <label className="font-medium text-gray-700 mb-1 block">픽업 예약일 (선택)</label>
                <Input type="date" value={gfPickupDate} onChange={(e) => setGfPickupDate(e.target.value)} />
              </div>

              {/* 고객 정보 */}
              <div className="space-y-2">
                <p className="font-medium text-gray-700">픽업지 (고객) 정보</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="이름 *" value={gfPickupName} onChange={(e) => setGfPickupName(e.target.value)} />
                  <Input placeholder="전화번호 * (숫자만)" value={gfPickupPhone} onChange={(e) => setGfPickupPhone(e.target.value)} />
                </div>
                <Input placeholder="우편번호 *" value={gfPickupZip} onChange={(e) => setGfPickupZip(e.target.value)} />
                <Input placeholder="주소 *" value={gfPickupAddr1} onChange={(e) => setGfPickupAddr1(e.target.value)} />
                <Input placeholder="상세주소" value={gfPickupAddr2} onChange={(e) => setGfPickupAddr2(e.target.value)} />
              </div>

              {/* 상품명 */}
              <div>
                <label className="font-medium text-gray-700 mb-1 block">반송 상품명</label>
                <Input placeholder="예: 반송 상품" value={gfItemName} onChange={(e) => setGfItemName(e.target.value)} />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowGfPickupModal(false)}>취소</Button>
                <Button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white" onClick={handleGfPickupSubmit} disabled={gfPickupLoading}>
                  {gfPickupLoading ? '요청 중...' : '픽업 요청'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
