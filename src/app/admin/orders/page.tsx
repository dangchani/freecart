import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Truck,
  X,
  Search,
  Download,
  Check,
  CreditCard,
  Filter,
  RefreshCw,
  Upload,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  Clock,
  Plus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_TRANSITIONS,
  isValidTransition,
  type OrderStatus,
} from '@/constants/orderStatus';
import { transitionOrderStatus } from '@/services/orders';

const PAGE_SIZE = 20;

interface ShippingCompany {
  id: string;
  name: string;
  code: string;
  trackingUrl: string | null;
}

interface Shipment {
  id: string;
  trackingNumber: string | null;
  shippingCompanyId: string | null;
  status: string;
  company?: { name: string; trackingUrl: string | null };
}

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  customerName: string;
  customerPhone: string;
  paymentMethod: string | null;
  createdAt: string;
  shipment?: Shipment;
}

interface OrderStats {
  total: number;
  pending: number;
  paid: number;
  processing: number;
  shipped: number;
  delivered: number;
  confirmed: number;
  cancelled: number;
  return_requested: number;
  returned: number;
  todayAmount: number;
  monthAmount: number;
}

const ALL_STATUSES: OrderStatus[] = [
  'pending', 'paid', 'processing', 'shipped', 'delivered',
  'confirmed', 'cancelled', 'return_requested', 'returned',
];

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  const [shippingCompanies, setShippingCompanies] = useState<ShippingCompany[]>([]);

  // 필터
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // 선택
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 통계
  const [stats, setStats] = useState<OrderStats>({
    total: 0, pending: 0, paid: 0, processing: 0, shipped: 0,
    delivered: 0, confirmed: 0, cancelled: 0, return_requested: 0,
    returned: 0, todayAmount: 0, monthAmount: 0,
  });

  // 운송장 등록 모달
  const [shipmentModal, setShipmentModal] = useState<{
    open: boolean;
    orderId: string;
    trackingNumber: string;
    shippingCompanyId: string;
    existingShipmentId?: string;
  }>({ open: false, orderId: '', trackingNumber: '', shippingCompanyId: '' });
  const [savingShipment, setSavingShipment] = useState(false);

  // 입금 확인 모달
  const [depositModal, setDepositModal] = useState<{
    open: boolean;
    orderId: string;
    orderNumber: string;
    amount: number;
    isBulk: boolean;
  }>({ open: false, orderId: '', orderNumber: '', amount: 0, isBulk: false });

  // 자동 구매확정 배치
  const [autoConfirmPending, setAutoConfirmPending] = useState(0);
  const [runningBatch, setRunningBatch] = useState(false);

  // 미입금 자동취소 배치
  const [unpaidExpiredCount, setUnpaidExpiredCount] = useState(0);
  const [runningCancelBatch, setRunningCancelBatch] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate('/auth/login'); return; }
      loadOrders();
      loadShippingCompanies();
      loadStats();
      loadAutoConfirmPending();
      loadUnpaidExpired();
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && user) loadOrders();
  }, [page, statusFilter, dateFrom, dateTo]);

  async function loadOrders() {
    try {
      setLoading(true);
      const supabase = createClient();

      let query = supabase
        .from('orders')
        .select('id, order_number, status, total_amount, orderer_name, orderer_phone, created_at, payment_method', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');

      const { data, error, count } = await query;
      if (error) throw error;

      setTotalCount(count ?? 0);

      const orderIds = (data ?? []).map((o: any) => o.id);
      let shipmentMap = new Map<string, Shipment>();
      if (orderIds.length > 0) {
        const { data: shipmentsData } = await supabase
          .from('shipments')
          .select('id, order_id, tracking_number, shipping_company_id, status, company:shipping_companies(name, tracking_url)')
          .in('order_id', orderIds);

        (shipmentsData ?? []).forEach((s: any) => {
          shipmentMap.set(s.order_id, {
            id: s.id,
            trackingNumber: s.tracking_number,
            shippingCompanyId: s.shipping_company_id,
            status: s.status,
            company: s.company ? { name: s.company.name, trackingUrl: s.company.tracking_url } : undefined,
          });
        });
      }

      setOrders((data ?? []).map((o: any) => ({
        id: o.id,
        orderNumber: o.order_number,
        status: o.status,
        totalAmount: o.total_amount,
        customerName: o.orderer_name,
        customerPhone: o.orderer_phone ?? '',
        paymentMethod: o.payment_method,
        createdAt: o.created_at,
        shipment: shipmentMap.get(o.id),
      })));
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('orders')
        .select('status, total_amount, created_at');

      if (!data) return;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const s: OrderStats = {
        total: data.length, pending: 0, paid: 0, processing: 0, shipped: 0,
        delivered: 0, confirmed: 0, cancelled: 0, return_requested: 0,
        returned: 0, todayAmount: 0, monthAmount: 0,
      };

      data.forEach((o: any) => {
        if (o.status in s) (s as any)[o.status]++;
        if (o.status !== 'cancelled' && o.status !== 'returned') {
          if (o.created_at >= todayStart) s.todayAmount += o.total_amount ?? 0;
          if (o.created_at >= monthStart) s.monthAmount += o.total_amount ?? 0;
        }
      });

      setStats(s);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  async function loadAutoConfirmPending() {
    try {
      const supabase = createClient();
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'delivered')
        .not('auto_confirm_at', 'is', null)
        .lte('auto_confirm_at', new Date().toISOString());
      setAutoConfirmPending(count ?? 0);
    } catch {
      // ignore
    }
  }

  async function handleRunAutoConfirm() {
    if (autoConfirmPending === 0) { alert('자동확정 대기 주문이 없습니다.'); return; }
    if (!confirm(`자동 구매확정을 실행합니다.\n대기 건수: ${autoConfirmPending}건\n계속하시겠습니까?`)) return;
    setRunningBatch(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('auto_confirm_orders');
      if (error) throw error;
      alert(`자동 구매확정 완료: ${data}건 처리되었습니다.`);
      await Promise.all([loadOrders(), loadStats(), loadAutoConfirmPending()]);
    } catch (err: any) {
      alert(err.message ?? '배치 실행 중 오류가 발생했습니다.');
    } finally {
      setRunningBatch(false);
    }
  }

  async function loadUnpaidExpired() {
    try {
      const supabase = createClient();
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .not('payment_deadline', 'is', null)
        .lte('payment_deadline', new Date().toISOString());
      setUnpaidExpiredCount(count ?? 0);
    } catch {
      // ignore
    }
  }

  async function handleRunCancelBatch() {
    if (unpaidExpiredCount === 0) { alert('미입금 만료 주문이 없습니다.'); return; }
    if (!confirm(`미입금 자동취소를 실행합니다.\n대상 건수: ${unpaidExpiredCount}건\n재고가 자동으로 복구됩니다. 계속하시겠습니까?`)) return;
    setRunningCancelBatch(true);
    try {
      const supabase = createClient();

      // 만료된 pending 주문 목록 조회
      const { data: expiredOrders, error: fetchErr } = await supabase
        .from('orders')
        .select('id')
        .eq('status', 'pending')
        .not('payment_deadline', 'is', null)
        .lte('payment_deadline', new Date().toISOString());

      if (fetchErr) throw fetchErr;

      // JS executeFullCancel로 각 주문 처리 (포인트·쿠폰·예치금 복구 포함)
      const { executeFullCancel } = await import('@/services/refundOrchestrator');
      let successCount = 0;
      const errors: string[] = [];

      for (const order of expiredOrders ?? []) {
        const result = await executeFullCancel(order.id, '미입금 자동취소 (입금기한 초과)', user?.id);
        if (result.success) {
          successCount++;
        } else {
          errors.push(`${order.id}: ${result.error}`);
        }
      }

      if (errors.length > 0) {
        alert(`${successCount}건 취소 완료, ${errors.length}건 실패:\n${errors.slice(0, 3).join('\n')}`);
      } else {
        alert(`미입금 자동취소 완료: ${successCount}건 처리되었습니다.`);
      }

      await Promise.all([loadOrders(), loadStats(), loadUnpaidExpired()]);
    } catch (err: any) {
      alert(err.message ?? '배치 실행 중 오류가 발생했습니다.');
    } finally {
      setRunningCancelBatch(false);
    }
  }

  async function loadShippingCompanies() {
    const supabase = createClient();
    const { data } = await supabase
      .from('shipping_companies')
      .select('id, name, code, tracking_url')
      .eq('is_active', true)
      .order('sort_order');
    setShippingCompanies(
      (data ?? []).map((c: any) => ({ id: c.id, name: c.name, code: c.code, trackingUrl: c.tracking_url }))
    );
  }

  // 검색 필터 (클라이언트 측, 페이지 내에서)
  const filteredOrders = orders.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerPhone.includes(q)
    );
  });

  // 선택
  function toggleSelectAll() {
    if (selectedIds.size === filteredOrders.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
  }
  function toggleSelect(id: string) {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  }

  // 일괄 상태 변경
  async function handleBulkStatusChange(toStatus: string) {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개 주문 상태를 '${ORDER_STATUS_LABELS[toStatus as OrderStatus]}'으로 변경하시겠습니까?`)) return;

    const ids = Array.from(selectedIds);
    let successCount = 0;
    const errors: string[] = [];

    for (const id of ids) {
      const order = orders.find((o) => o.id === id);
      if (!order) continue;
      if (!isValidTransition(order.status as OrderStatus, toStatus as OrderStatus)) {
        errors.push(`${order.orderNumber}: ${ORDER_STATUS_LABELS[order.status as OrderStatus]} → ${ORDER_STATUS_LABELS[toStatus as OrderStatus]} 전이 불가`);
        continue;
      }
      try {
        await transitionOrderStatus(id, toStatus as OrderStatus, { changedBy: user?.id });
        successCount++;
      } catch (e: any) {
        errors.push(`${order.orderNumber}: ${e.message}`);
      }
    }

    setSelectedIds(new Set());
    await loadOrders();
    await loadStats();

    if (errors.length > 0) alert(`${successCount}건 성공, ${errors.length}건 실패:\n${errors.join('\n')}`);
    else alert(`${successCount}건 상태 변경 완료`);
  }

  // 개별 상태 변경
  async function handleStatusChange(orderId: string, toStatus: string) {
    try {
      await transitionOrderStatus(orderId, toStatus as OrderStatus, { changedBy: user?.id });
      await loadOrders();
      await loadStats();
    } catch (err: any) {
      alert(err.message ?? '상태 변경 중 오류가 발생했습니다.');
    }
  }

  // 입금 확인 (단건)
  function openDepositModal(order: OrderRow) {
    setDepositModal({ open: true, orderId: order.id, orderNumber: order.orderNumber, amount: order.totalAmount, isBulk: false });
  }

  // 일괄 입금 확인
  function openBulkDepositModal() {
    const pendingSelected = Array.from(selectedIds).filter((id) => {
      const o = orders.find((x) => x.id === id);
      return o?.status === 'pending' && o?.paymentMethod !== 'card';
    });
    if (pendingSelected.length === 0) { alert('입금 확인 가능한 주문이 없습니다.'); return; }
    setDepositModal({ open: true, orderId: pendingSelected.join(','), orderNumber: `${pendingSelected.length}건`, amount: 0, isBulk: true });
  }

  async function handleConfirmDeposit() {
    try {
      const supabase = createClient();
      const ids = depositModal.isBulk
        ? depositModal.orderId.split(',')
        : [depositModal.orderId];

      for (const id of ids) {
        await transitionOrderStatus(id, 'paid', { note: '수동 입금 확인', changedBy: user?.id });
        await supabase
          .from('order_virtual_accounts')
          .update({ status: 'deposited', deposited_at: new Date().toISOString() })
          .eq('order_id', id);
      }

      setDepositModal({ open: false, orderId: '', orderNumber: '', amount: 0, isBulk: false });
      setSelectedIds(new Set());
      await loadOrders();
      await loadStats();
      alert(`${ids.length}건 입금 확인 완료`);
    } catch (err: any) {
      alert(err.message ?? '입금 확인 처리 중 오류가 발생했습니다.');
    }
  }

  // 운송장 등록
  function openShipmentModal(order: OrderRow) {
    setShipmentModal({
      open: true,
      orderId: order.id,
      trackingNumber: order.shipment?.trackingNumber ?? '',
      shippingCompanyId: order.shipment?.shippingCompanyId ?? '',
      existingShipmentId: order.shipment?.id,
    });
  }

  async function handleSaveShipment() {
    if (!shipmentModal.trackingNumber || !shipmentModal.shippingCompanyId) {
      alert('배송사와 운송장 번호를 모두 입력해주세요.');
      return;
    }
    setSavingShipment(true);
    try {
      const supabase = createClient();
      const shipmentData = {
        shipping_company_id: shipmentModal.shippingCompanyId,
        tracking_number: shipmentModal.trackingNumber,
        status: 'shipped',
        shipped_at: new Date().toISOString(),
      };

      if (shipmentModal.existingShipmentId) {
        await supabase.from('shipments').update(shipmentData).eq('id', shipmentModal.existingShipmentId);
      } else {
        await supabase.from('shipments').insert({ order_id: shipmentModal.orderId, ...shipmentData });
      }

      const order = orders.find((o) => o.id === shipmentModal.orderId);
      if (order && isValidTransition(order.status as OrderStatus, 'shipped')) {
        await transitionOrderStatus(shipmentModal.orderId, 'shipped', { note: `운송장: ${shipmentModal.trackingNumber}`, changedBy: user?.id });
      }

      setShipmentModal({ open: false, orderId: '', trackingNumber: '', shippingCompanyId: '' });
      await loadOrders();
      alert('운송장이 등록되었습니다.');
    } catch (err: any) {
      alert(err.message ?? '운송장 등록 중 오류가 발생했습니다.');
    } finally {
      setSavingShipment(false);
    }
  }

  // CSV 내보내기
  async function handleExport() {
    const headers = ['주문번호', '주문일시', '고객명', '전화번호', '결제방법', '금액', '상태', '운송장번호'];
    const rows = filteredOrders.map((o) => [
      o.orderNumber,
      format(new Date(o.createdAt), 'yyyy-MM-dd HH:mm'),
      o.customerName,
      o.customerPhone,
      o.paymentMethod ?? '',
      o.totalAmount,
      ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status,
      o.shipment?.trackingNumber ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const pendingNonCardSelected = Array.from(selectedIds).filter((id) => {
    const o = orders.find((x) => x.id === id);
    return o?.status === 'pending' && o?.paymentMethod !== 'card';
  });

  if (authLoading) return <div className="container py-8">로딩 중...</div>;

  return (
    <div className="container py-8">
      <Link to="/admin" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        대시보드로 돌아가기
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">주문 관리</h1>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/admin/orders/new')}>
            <Plus className="mr-2 h-4 w-4" />새 주문 생성
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/orders/bulk-shipment')}>
            <Upload className="mr-2 h-4 w-4" />일괄 송장 등록
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />내보내기
          </Button>
          <Button variant="outline" onClick={() => { loadOrders(); loadStats(); loadAutoConfirmPending(); loadUnpaidExpired(); }}>
            <RefreshCw className="mr-2 h-4 w-4" />새로고침
          </Button>
        </div>
      </div>

      {/* 자동 구매확정 배치 패널 */}
      {autoConfirmPending > 0 && (
        <Card className="mb-4 flex items-center justify-between gap-4 bg-amber-50 border-amber-200 px-5 py-3">
          <div className="flex items-center gap-3">
            <PlayCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                자동 구매확정 대기 {autoConfirmPending}건
              </p>
              <p className="text-xs text-amber-600">배송완료 후 자동확정 기간이 지난 주문이 있습니다.</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleRunAutoConfirm}
            disabled={runningBatch}
            className="bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0"
          >
            {runningBatch ? '처리 중...' : '지금 자동확정 실행'}
          </Button>
        </Card>
      )}

      {/* 미입금 자동취소 배치 패널 */}
      {unpaidExpiredCount > 0 && (
        <Card className="mb-4 flex items-center justify-between gap-4 bg-red-50 border-red-200 px-5 py-3">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                미입금 만료 {unpaidExpiredCount}건
              </p>
              <p className="text-xs text-red-600">입금 기한이 지난 대기 주문이 있습니다. 재고가 자동으로 복구됩니다.</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleRunCancelBatch}
            disabled={runningCancelBatch}
            className="bg-red-600 hover:bg-red-700 text-white flex-shrink-0"
          >
            {runningCancelBatch ? '처리 중...' : '지금 자동취소 실행'}
          </Button>
        </Card>
      )}

      {/* 통계 카드 */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {ALL_STATUSES.map((s) => (
          <Card
            key={s}
            className={`p-3 text-center cursor-pointer transition-all ${statusFilter === s ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => { setStatusFilter(s === statusFilter ? 'all' : s); setPage(0); }}
          >
            <p className="text-xs text-gray-500 truncate">{ORDER_STATUS_LABELS[s]}</p>
            <p className="text-xl font-bold">{(stats as any)[s] ?? 0}</p>
          </Card>
        ))}
        <Card className="p-3 text-center col-span-1">
          <p className="text-xs text-gray-500">오늘 매출</p>
          <p className="text-sm font-bold text-green-700">{formatCurrency(stats.todayAmount)}</p>
        </Card>
        <Card className="p-3 text-center col-span-1">
          <p className="text-xs text-gray-500">이번달 매출</p>
          <p className="text-sm font-bold text-blue-700">{formatCurrency(stats.monthAmount)}</p>
        </Card>
      </div>

      {/* 필터 */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="주문번호 / 고객명 / 전화번호"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[150px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{ORDER_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="w-[150px]" />
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="w-[150px]" />
        </div>
      </Card>

      {/* 선택 액션바 */}
      {selectedIds.size > 0 && (
        <Card className="mb-4 p-3 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-medium text-blue-700">{selectedIds.size}개 선택됨</span>
            <div className="flex gap-2 flex-wrap">
              {pendingNonCardSelected.length > 0 && (
                <Button size="sm" variant="outline" onClick={openBulkDepositModal}>
                  <CreditCard className="mr-1 h-4 w-4" />
                  일괄 입금 확인 ({pendingNonCardSelected.length})
                </Button>
              )}
              <Select onValueChange={handleBulkStatusChange}>
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue placeholder="일괄 상태 변경" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.filter((s) => s !== 'pending').map((s) => (
                    <SelectItem key={s} value={s}>{ORDER_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 주문 목록 */}
      {loading ? (
        <Card className="p-12 text-center text-gray-400">로딩 중...</Card>
      ) : filteredOrders.length === 0 ? (
        <Card className="p-12 text-center text-gray-500">
          {orders.length === 0 ? '주문 내역이 없습니다.' : '검색 결과가 없습니다.'}
        </Card>
      ) : (
        <Card>
          {/* 헤더 */}
          <div className="flex items-center gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-600">
            <input type="checkbox"
              checked={selectedIds.size === filteredOrders.length && filteredOrders.length > 0}
              onChange={toggleSelectAll} className="h-4 w-4 rounded" />
            <div className="w-36">주문번호</div>
            <div className="flex-1">고객정보</div>
            <div className="w-24 text-center">결제금액</div>
            <div className="w-28 text-center">상태</div>
            <div className="w-52"></div>
          </div>

          <div className="divide-y">
            {filteredOrders.map((order) => {
              const statusColor = ORDER_STATUS_COLORS[order.status as OrderStatus] ?? 'bg-gray-100 text-gray-700';
              const nextStates = ORDER_STATUS_TRANSITIONS[order.status as OrderStatus] ?? [];
              const isFinal = nextStates.length === 0;
              const trackingUrl = order.shipment?.company?.trackingUrl && order.shipment.trackingNumber
                ? order.shipment.company.trackingUrl.replace('{tracking_number}', order.shipment.trackingNumber)
                : null;

              return (
                <div key={order.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                  <input type="checkbox" checked={selectedIds.has(order.id)}
                    onChange={() => toggleSelect(order.id)} className="h-4 w-4 rounded" />

                  <div className="w-36">
                    <p className="font-mono text-sm font-medium">{order.orderNumber}</p>
                    <p className="text-xs text-gray-500">{format(new Date(order.createdAt), 'MM/dd HH:mm')}</p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{order.customerName}</p>
                    <p className="text-xs text-gray-500">{order.customerPhone}</p>
                    {order.paymentMethod && (
                      <p className="text-xs text-gray-400">
                        {order.paymentMethod === 'card' && '카드'}
                        {order.paymentMethod === 'virtual_account' && '가상계좌'}
                        {order.paymentMethod === 'bank_transfer' && '무통장'}
                      </p>
                    )}
                  </div>

                  <div className="w-24 text-center">
                    <p className="font-medium text-sm">{formatCurrency(order.totalAmount)}</p>
                  </div>

                  <div className="w-28 text-center">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusColor}`}>
                      {ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}
                    </span>
                    {trackingUrl && (
                      <a href={trackingUrl} target="_blank" rel="noopener noreferrer"
                        className="mt-1 block text-xs text-blue-500 hover:underline">
                        배송조회
                      </a>
                    )}
                  </div>

                  <div className="flex gap-1 w-52 justify-end">
                    {order.status === 'pending' && order.paymentMethod !== 'card' && (
                      <Button size="sm" variant="outline" onClick={() => openDepositModal(order)} title="입금 확인">
                        <CreditCard className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {!isFinal ? (
                      <Select value={order.status} onValueChange={(v) => handleStatusChange(order.id, v)}>
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={order.status} disabled>
                            {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                          </SelectItem>
                          {nextStates.map((s) => (
                            <SelectItem key={s} value={s}>{ORDER_STATUS_LABELS[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="w-28 h-8 inline-flex items-center justify-center text-xs text-gray-400">확정됨</span>
                    )}

                    <Button size="sm" variant="ghost" onClick={() => openShipmentModal(order)} title="운송장 등록">
                      <Truck className="h-4 w-4" />
                    </Button>

                    <Link to={`/admin/orders/${order.id}`}>
                      <Button size="sm" variant="ghost">상세</Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = page < 4 ? i : page - 3 + i;
            if (p >= totalPages) return null;
            return (
              <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm"
                onClick={() => setPage(p)}>
                {p + 1}
              </Button>
            );
          })}
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-500 ml-2">총 {totalCount}건</span>
        </div>
      )}

      {/* 운송장 등록 모달 */}
      {shipmentModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">운송장 등록</h2>
              <button onClick={() => setShipmentModal({ open: false, orderId: '', trackingNumber: '', shippingCompanyId: '' })}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">배송사</label>
                <Select value={shipmentModal.shippingCompanyId}
                  onValueChange={(v) => setShipmentModal((p) => ({ ...p, shippingCompanyId: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="배송사 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {shippingCompanies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">운송장 번호</label>
                <Input value={shipmentModal.trackingNumber}
                  onChange={(e) => setShipmentModal((p) => ({ ...p, trackingNumber: e.target.value }))}
                  placeholder="운송장 번호 입력" className="mt-1" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShipmentModal({ open: false, orderId: '', trackingNumber: '', shippingCompanyId: '' })}>
                취소
              </Button>
              <Button onClick={handleSaveShipment} disabled={savingShipment}>
                {savingShipment ? '저장 중...' : '저장'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 입금 확인 모달 */}
      {depositModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">입금 확인</h2>
              <button onClick={() => setDepositModal({ open: false, orderId: '', orderNumber: '', amount: 0, isBulk: false })}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">주문번호</p>
                <p className="font-mono font-bold">{depositModal.orderNumber}</p>
              </div>
              {!depositModal.isBulk && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600">입금 금액</p>
                  <p className="text-xl font-bold text-blue-700">{formatCurrency(depositModal.amount)}</p>
                </div>
              )}
              <p className="text-sm text-gray-500">
                입금 확인 시 주문 상태가 <strong>입금확인</strong>으로 변경됩니다.
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDepositModal({ open: false, orderId: '', orderNumber: '', amount: 0, isBulk: false })}>
                취소
              </Button>
              <Button onClick={handleConfirmDeposit}>
                <Check className="mr-2 h-4 w-4" />입금 확인
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
