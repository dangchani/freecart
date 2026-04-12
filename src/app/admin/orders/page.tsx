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
  Calendar,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  SlidersHorizontal,
  MessageSquare,
  MapPin,
  Lock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  // Phase 2 확장
  recipientName: string;
  address: string;
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  hasAdminMemo: boolean;
  paymentDeadline: string | null;
  isAdminOrder: boolean;
  productSummary: string;
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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  all: '전체 결제수단',
  card: '신용카드',
  virtual_account: '가상계좌',
  bank_transfer: '무통장입금',
  deposit: '예치금',
  point: '포인트',
};

function getDateRange(preset: 'today' | 'yesterday' | 'week' | 'month') {
  const d = new Date();
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  const today = fmt(d);
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'yesterday') {
    const y = new Date(d); y.setDate(d.getDate() - 1);
    return { from: fmt(y), to: fmt(y) };
  }
  if (preset === 'week') {
    const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return { from: fmt(mon), to: today };
  }
  return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, to: today };
}

type SortField = 'created_at' | 'total_amount' | 'order_number';
type SortDir   = 'asc' | 'desc';

// 항상 표시되는 고정 컬럼 (비활성 체크박스로 표시)
const FIXED_COLUMNS = [
  { key: 'order_number', label: '주문번호' },
  { key: 'customer',     label: '고객정보' },
  { key: 'total_amount', label: '결제금액' },
  { key: 'status',       label: '주문상태' },
  { key: 'created_at',   label: '주문일시' },
  { key: 'actions',      label: '액션'     },
] as const;

// 독립 셀로 노출/순서 변경 가능한 선택 컬럼
const COLUMN_DEFS = [
  { key: 'product',   label: '상품 요약',   defaultVisible: true  },
  { key: 'recipient', label: '수령인',      defaultVisible: false },
  { key: 'address',   label: '배송주소',    defaultVisible: false },
  { key: 'discount',  label: '할인/배송비', defaultVisible: false },
] as const;

// 독립 셀 없이 기존 셀 내부에 표시되는 인디케이터 컬럼
const INDICATOR_DEFS = [
  { key: 'memo',     label: '메모 아이콘',  description: '결제금액 셀 내 표시', defaultVisible: true  },
  { key: 'deadline', label: '입금마감',     description: '주문상태 셀 내 표시', defaultVisible: true  },
] as const;

type ColumnKey    = typeof COLUMN_DEFS[number]['key'];
type IndicatorKey = typeof INDICATOR_DEFS[number]['key'];
type AnyColumnKey = ColumnKey | IndicatorKey;

const DEFAULT_COLUMN_ORDER: ColumnKey[] = ['product', 'recipient', 'address', 'discount'];

const COLUMN_PRESETS: Record<string, { label: string; visible: AnyColumnKey[]; order: ColumnKey[] }> = {
  default: {
    label: '기본',
    visible: ['product', 'memo', 'deadline'],
    order: [...DEFAULT_COLUMN_ORDER],
  },
  simple: {
    label: '간단히',
    visible: [],
    order: [...DEFAULT_COLUMN_ORDER],
  },
  detail: {
    label: '상세',
    visible: ['product', 'recipient', 'address', 'discount', 'memo', 'deadline'],
    order: [...DEFAULT_COLUMN_ORDER],
  },
};

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  const [shippingCompanies, setShippingCompanies] = useState<ShippingCompany[]>([]);

  // 필터 — 통합 검색
  const [searchQuery, setSearchQuery] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');

  // 필터 — 상세 검색
  const [detailSearchOpen, setDetailSearchOpen] = useState(false);
  const [detailFields, setDetailFields] = useState({
    orderNumber: '', customerName: '', phone: '', productName: '',
  });
  const [committedDetailFields, setCommittedDetailFields] = useState<{
    orderNumber: string; customerName: string; phone: string; productName: string;
  } | null>(null);

  // 필터 — 공통
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
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

  // 정렬
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // 컬럼 가시성 (선택 컬럼 + 인디케이터 컬럼 통합 관리)
  const [visibleColumns, setVisibleColumns] = useState<Set<AnyColumnKey>>(() => {
    try {
      const saved = localStorage.getItem('admin_orders_columns');
      if (saved) return new Set(JSON.parse(saved) as AnyColumnKey[]);
    } catch {}
    return new Set([
      ...COLUMN_DEFS.filter((c) => c.defaultVisible).map((c) => c.key),
      ...INDICATOR_DEFS.filter((c) => c.defaultVisible).map((c) => c.key),
    ]);
  });

  // 선택 컬럼 순서
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(() => {
    try {
      const saved = localStorage.getItem('admin_orders_column_order');
      if (saved) {
        const parsed = JSON.parse(saved) as ColumnKey[];
        const missing = DEFAULT_COLUMN_ORDER.filter((k) => !parsed.includes(k));
        return [...parsed, ...missing];
      }
    } catch {}
    return [...DEFAULT_COLUMN_ORDER];
  });

  const [columnPickerOpen, setColumnPickerOpen] = useState(false);

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
  }, [page, statusFilters, dateFrom, dateTo, committedSearch, committedDetailFields, paymentMethodFilter, sortField, sortDir]);

  useEffect(() => {
    try {
      localStorage.setItem('admin_orders_columns', JSON.stringify([...visibleColumns]));
      localStorage.setItem('admin_orders_column_order', JSON.stringify(columnOrder));
    } catch {}
  }, [visibleColumns, columnOrder]);

  async function loadOrders() {
    try {
      setLoading(true);
      const supabase = createClient();

      let query = supabase
        .from('orders')
        .select(
          `id, order_number, status, total_amount, orderer_name, orderer_phone, payment_method, created_at,
           recipient_name, postal_code, address1,
           subtotal, discount_amount, coupon_discount, shipping_fee, used_points, used_deposit,
           admin_memo, payment_deadline, is_admin_order`,
          { count: 'exact' }
        )
        .order(sortField, { ascending: sortDir === 'asc' })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilters.size > 0) query = query.in('status', Array.from(statusFilters));
      if (dateFrom) query = query.gte('created_at', dateFrom);
      if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');
      if (paymentMethodFilter !== 'all') query = query.eq('payment_method', paymentMethodFilter);

      // 통합 검색 — 주문번호·고객명·전화번호 OR
      if (committedSearch) {
        query = query.or(
          `order_number.ilike.%${committedSearch}%,` +
          `orderer_name.ilike.%${committedSearch}%,` +
          `orderer_phone.ilike.%${committedSearch}%`
        );
      }

      // 상세 검색 — 각 필드 AND
      if (committedDetailFields) {
        const { orderNumber, customerName, phone, productName } = committedDetailFields;
        if (orderNumber)  query = query.ilike('order_number',  `%${orderNumber}%`);
        if (customerName) query = query.ilike('orderer_name',  `%${customerName}%`);
        if (phone)        query = query.ilike('orderer_phone', `%${phone}%`);
        if (productName) {
          const { data: productSearchIds } = await supabase.rpc('search_orders_by_product', { keyword: productName });
          const ids = (productSearchIds ?? []).map((r: any) => r.order_id);
          if (ids.length === 0) {
            setOrders([]);
            setTotalCount(0);
            setLoading(false);
            return;
          }
          query = query.in('id', ids);
        }
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setTotalCount(count ?? 0);

      const orderIds = (data ?? []).map((o: any) => o.id);

      // 배송 정보
      let shipmentMap = new Map<string, Shipment>();
      // 상품 요약
      let productSummaryMap = new Map<string, string>();

      if (orderIds.length > 0) {
        const [shipmentsRes, itemsRes] = await Promise.all([
          supabase
            .from('shipments')
            .select('id, order_id, tracking_number, shipping_company_id, status, company:shipping_companies(name, tracking_url)')
            .in('order_id', orderIds),
          supabase
            .from('order_items')
            .select('order_id, product_name, option_text, quantity')
            .in('order_id', orderIds)
            .neq('item_type', 'gift')
            .order('created_at', { ascending: true }),
        ]);

        (shipmentsRes.data ?? []).forEach((s: any) => {
          shipmentMap.set(s.order_id, {
            id: s.id,
            trackingNumber: s.tracking_number,
            shippingCompanyId: s.shipping_company_id,
            status: s.status,
            company: s.company ? { name: s.company.name, trackingUrl: s.company.tracking_url } : undefined,
          });
        });

        const grouped = new Map<string, any[]>();
        (itemsRes.data ?? []).forEach((item: any) => {
          if (!grouped.has(item.order_id)) grouped.set(item.order_id, []);
          grouped.get(item.order_id)!.push(item);
        });
        grouped.forEach((items, orderId) => {
          const first = items[0];
          const label = first.option_text
            ? `${first.product_name} (${first.option_text}) ${first.quantity}개`
            : `${first.product_name} ${first.quantity}개`;
          productSummaryMap.set(orderId, items.length > 1 ? `${label} 외 ${items.length - 1}건` : label);
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
        recipientName: o.recipient_name ?? '',
        address: o.postal_code ? `(${o.postal_code}) ${o.address1 ?? ''}` : (o.address1 ?? ''),
        subtotal: o.subtotal ?? 0,
        discountTotal: (o.discount_amount ?? 0) + (o.coupon_discount ?? 0)
                     + (o.used_points ?? 0) + (o.used_deposit ?? 0),
        shippingFee: o.shipping_fee ?? 0,
        hasAdminMemo: !!o.admin_memo,
        paymentDeadline: o.payment_deadline ?? null,
        isAdminOrder: o.is_admin_order ?? false,
        productSummary: productSummaryMap.get(o.id) ?? '',
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

  // 선택
  function toggleSelectAll() {
    if (selectedIds.size === orders.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(orders.map((o) => o.id)));
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

  // 컬럼 ON/OFF 토글
  function toggleColumn(key: AnyColumnKey) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // 선택 컬럼 순서 이동 (direction: -1=위, +1=아래)
  function moveColumn(index: number, direction: -1 | 1) {
    setColumnOrder((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // 프리셋 적용
  function applyPreset(key: keyof typeof COLUMN_PRESETS) {
    const preset = COLUMN_PRESETS[key];
    setVisibleColumns(new Set(preset.visible));
    setColumnOrder([...preset.order]);
  }

  // 통합 검색 실행
  function handleQuickSearch() {
    setDetailFields({ orderNumber: '', customerName: '', phone: '', productName: '' });
    setCommittedDetailFields(null);
    setCommittedSearch(searchQuery);
    setPage(0);
  }

  // 상세 검색 실행
  function handleDetailSearch() {
    const hasAny = Object.values(detailFields).some((v) => v.trim() !== '');
    setSearchQuery('');
    setCommittedSearch('');
    setCommittedDetailFields(hasAny ? { ...detailFields } : null);
    setPage(0);
  }

  // 상세 검색 전체 초기화
  function handleDetailClear() {
    setDetailFields({ orderNumber: '', customerName: '', phone: '', productName: '' });
    setCommittedDetailFields(null);
    setPaymentMethodFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(0);
  }

  // 상세 검색 필드 개별 초기화 (태그 × 클릭 시)
  function clearDetailField(key: keyof typeof detailFields) {
    const next = { ...detailFields, [key]: '' };
    setDetailFields(next);
    const hasAny = Object.values(next).some((v) => v.trim() !== '');
    setCommittedDetailFields(hasAny ? next : null);
    setPage(0);
  }

  // 현재 필터 조건으로 orders 전체 조회 (페이지 무관, 1000건씩 페이지네이션)
  async function fetchAllOrdersForExport() {
    const supabase = createClient();

    // 상품명 검색 시 order_id 목록 선취
    let productSearchIds: string[] | undefined;
    if (committedDetailFields?.productName) {
      const { data } = await supabase.rpc('search_orders_by_product', { keyword: committedDetailFields.productName });
      const ids = (data ?? []).map((r: any) => r.order_id as string);
      if (ids.length === 0) return [];
      productSearchIds = ids;
    }

    const FETCH_SIZE = 1000;
    const allOrders: any[] = [];
    let offset = 0;

    while (true) {
      let q = supabase
        .from('orders')
        .select('id, order_number, status, total_amount, orderer_name, orderer_phone, created_at, payment_method, recipient_name')
        .order('created_at', { ascending: false })
        .range(offset, offset + FETCH_SIZE - 1);

      if (statusFilters.size > 0) q = q.in('status', Array.from(statusFilters));
      if (dateFrom) q = q.gte('created_at', dateFrom);
      if (dateTo) q = q.lte('created_at', dateTo + 'T23:59:59');
      if (paymentMethodFilter !== 'all') q = q.eq('payment_method', paymentMethodFilter);
      if (committedSearch) {
        q = q.or(
          `order_number.ilike.%${committedSearch}%,` +
          `orderer_name.ilike.%${committedSearch}%,` +
          `orderer_phone.ilike.%${committedSearch}%`
        );
      }
      if (committedDetailFields) {
        const { orderNumber, customerName, phone } = committedDetailFields;
        if (orderNumber)  q = q.ilike('order_number',  `%${orderNumber}%`);
        if (customerName) q = q.ilike('orderer_name',  `%${customerName}%`);
        if (phone)        q = q.ilike('orderer_phone', `%${phone}%`);
      }
      if (productSearchIds) q = q.in('id', productSearchIds);

      const { data, error } = await q;
      if (error) throw error;
      allOrders.push(...(data ?? []));
      if ((data ?? []).length < FETCH_SIZE) break;
      offset += FETCH_SIZE;
    }

    return allOrders;
  }

  // CSV 내보내기 — 주문별 (1행 = 1주문)
  async function handleExport() {
    try {
      const exportData = await fetchAllOrdersForExport();
      if (exportData.length === 0) { alert('내보낼 주문이 없습니다.'); return; }

      const headers = ['주문번호', '주문일시', '고객명', '전화번호', '결제방법', '금액', '상태'];
      const rows = exportData.map((o: any) => [
        o.order_number,
        format(new Date(o.created_at), 'yyyy-MM-dd HH:mm'),
        o.orderer_name,
        o.orderer_phone ?? '',
        PAYMENT_METHOD_LABELS[o.payment_method] ?? o.payment_method ?? '',
        o.total_amount,
        ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status,
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
    } catch (err) {
      console.error('Export failed:', err);
    }
  }

  const ITEM_TYPE_LABELS: Record<string, string> = {
    normal: '일반', set: '세트', bundle: '묶음', gift: '증정',
  };

  // CSV 내보내기 — SKU별 (1행 = 1 order_item)
  async function handleExportSku() {
    try {
      const allOrders = await fetchAllOrdersForExport();
      if (allOrders.length === 0) { alert('내보낼 주문이 없습니다.'); return; }

      const orderMap = new Map<string, any>(allOrders.map((o) => [o.id, o]));
      const orderIds = allOrders.map((o) => o.id);

      // order_items + SKU 를 500건 배치로 조회
      const BATCH = 500;
      const supabase = createClient();
      const allItems: any[] = [];

      for (let i = 0; i < orderIds.length; i += BATCH) {
        const batch = orderIds.slice(i, i + BATCH);
        const { data, error } = await supabase
          .from('order_items')
          .select('order_id, product_name, option_text, unit_price, quantity, discount_amount, total_price, item_type, status, variant_id, product_variants(sku)')
          .in('order_id', batch)
          .order('created_at', { ascending: true });
        if (error) throw error;
        allItems.push(...(data ?? []));
      }

      if (allItems.length === 0) { alert('내보낼 상품 항목이 없습니다.'); return; }

      const headers = [
        '주문번호', '주문일시', '고객명', '수령인', '전화번호', '결제수단', '주문상태',
        '상품명', '옵션', 'SKU', '단가', '수량', '할인금액', '소계', '상품유형', '아이템상태',
      ];
      const rows = allItems.map((item: any) => {
        const order = orderMap.get(item.order_id);
        const sku = (item.product_variants as any)?.sku ?? '-';
        return [
          order?.order_number ?? '',
          order ? format(new Date(order.created_at), 'yyyy-MM-dd HH:mm') : '',
          order?.orderer_name ?? '',
          order?.recipient_name ?? '',
          order?.orderer_phone ?? '',
          PAYMENT_METHOD_LABELS[order?.payment_method] ?? order?.payment_method ?? '',
          ORDER_STATUS_LABELS[order?.status as OrderStatus] ?? order?.status ?? '',
          item.product_name ?? '',
          item.option_text ?? '',
          sku,
          item.unit_price ?? 0,
          item.quantity ?? 0,
          item.discount_amount ?? 0,
          item.total_price ?? 0,
          ITEM_TYPE_LABELS[item.item_type] ?? item.item_type ?? '',
          ORDER_STATUS_LABELS[item.status as OrderStatus] ?? item.status ?? '',
        ];
      });

      const csv = [headers, ...rows]
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_sku_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('SKU export failed:', err);
    }
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
            <Download className="mr-2 h-4 w-4" />주문별 내보내기
          </Button>
          <Button variant="outline" onClick={handleExportSku}>
            <Download className="mr-2 h-4 w-4" />SKU별 내보내기
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
            className={`p-3 text-center cursor-pointer transition-all ${statusFilters.has(s) ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => {
              setStatusFilters((prev) => {
                const next = new Set(prev);
                next.has(s) ? next.delete(s) : next.add(s);
                return next;
              });
              setPage(0);
            }}
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
      <Card className="mb-4 p-4 space-y-3">
        {/* 기본 검색 행 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="주문번호 · 고객명 · 전화번호 통합 검색"
              value={searchQuery}
              disabled={!!committedDetailFields}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickSearch()}
              className={`pl-10 ${committedDetailFields ? 'bg-gray-50 text-gray-400' : ''}`}
            />
          </div>
          <Button onClick={handleQuickSearch} disabled={!!committedDetailFields}>
            검색
          </Button>
          <Button
            variant="outline"
            onClick={() => setDetailSearchOpen((v) => !v)}
            className={`flex items-center gap-1 ${detailSearchOpen || !!committedDetailFields ? 'border-blue-400 text-blue-600 bg-blue-50' : ''}`}
          >
            상세검색
            {detailSearchOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {/* 패널 닫혀있지만 상세검색 활성 중 표시 */}
            {committedDetailFields && !detailSearchOpen && (
              <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
            )}
          </Button>
        </div>

        {/* 상세 검색 패널 */}
        {detailSearchOpen && (
          <div className="border-t pt-3 space-y-3">
            {/* 검색 필드 2열 그리드 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">주문번호</label>
                <Input
                  placeholder="주문번호 일부 입력"
                  value={detailFields.orderNumber}
                  onChange={(e) => setDetailFields((p) => ({ ...p, orderNumber: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleDetailSearch()}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">고객명</label>
                <Input
                  placeholder="주문자명 / 수령인명"
                  value={detailFields.customerName}
                  onChange={(e) => setDetailFields((p) => ({ ...p, customerName: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleDetailSearch()}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">전화번호</label>
                <Input
                  placeholder="'-' 없이 입력"
                  value={detailFields.phone}
                  onChange={(e) => setDetailFields((p) => ({ ...p, phone: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleDetailSearch()}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">상품명</label>
                <Input
                  placeholder="상품명 또는 옵션명"
                  value={detailFields.productName}
                  onChange={(e) => setDetailFields((p) => ({ ...p, productName: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleDetailSearch()}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* 결제수단 + 날짜 */}
            <div className="flex flex-wrap items-center gap-3 pt-1 border-t">
              <Select value={paymentMethodFilter} onValueChange={(v) => setPaymentMethodFilter(v)}>
                <SelectTrigger className="w-[160px] h-8 text-sm">
                  <Filter className="mr-1 h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-1">
                {(['today', 'yesterday', 'week', 'month'] as const).map((preset) => {
                  const labels = { today: '오늘', yesterday: '어제', week: '이번 주', month: '이번 달' };
                  return (
                    <Button key={preset} size="sm" variant="outline" className="h-8 text-xs"
                      onClick={() => { const { from, to } = getDateRange(preset); setDateFrom(from); setDateTo(to); }}>
                      {labels[preset]}
                    </Button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 ml-auto">
                <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[130px] h-8 text-sm" />
                <span className="text-gray-400 text-sm">~</span>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[130px] h-8 text-sm" />
              </div>
            </div>

            {/* 실행 버튼 */}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={handleDetailClear}>
                전체 초기화
              </Button>
              <Button size="sm" onClick={handleDetailSearch}>
                상세검색 실행
              </Button>
            </div>
          </div>
        )}

        {/* 적용된 필터 태그 */}
        {(() => {
          const tags = [
            committedSearch && {
              key: 'search',
              label: `검색: ${committedSearch}`,
              clear: () => { setCommittedSearch(''); setSearchQuery(''); setPage(0); },
            },
            committedDetailFields?.orderNumber && {
              key: 'detail_order',
              label: `주문번호: ${committedDetailFields.orderNumber}`,
              clear: () => clearDetailField('orderNumber'),
            },
            committedDetailFields?.customerName && {
              key: 'detail_name',
              label: `고객명: ${committedDetailFields.customerName}`,
              clear: () => clearDetailField('customerName'),
            },
            committedDetailFields?.phone && {
              key: 'detail_phone',
              label: `전화번호: ${committedDetailFields.phone}`,
              clear: () => clearDetailField('phone'),
            },
            committedDetailFields?.productName && {
              key: 'detail_product',
              label: `상품명: ${committedDetailFields.productName}`,
              clear: () => clearDetailField('productName'),
            },
            statusFilters.size > 0 && {
              key: 'status',
              label: `상태: ${Array.from(statusFilters).map((s) => ORDER_STATUS_LABELS[s as OrderStatus]).join(', ')}`,
              clear: () => { setStatusFilters(new Set()); setPage(0); },
            },
            paymentMethodFilter !== 'all' && {
              key: 'payment',
              label: `결제: ${PAYMENT_METHOD_LABELS[paymentMethodFilter]}`,
              clear: () => { setPaymentMethodFilter('all'); setPage(0); },
            },
            (dateFrom || dateTo) && {
              key: 'date',
              label: `기간: ${dateFrom || '~'} ~ ${dateTo || '~'}`,
              clear: () => { setDateFrom(''); setDateTo(''); setPage(0); },
            },
          ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

          if (tags.length === 0) return null;
          return (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
              <span className="text-xs text-gray-400 flex-shrink-0">적용된 필터:</span>
              {tags.map((tag) => (
                <span key={tag.key}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs text-blue-700">
                  {tag.label}
                  <button onClick={tag.clear} className="ml-0.5 hover:text-blue-900">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={() => {
                  setCommittedSearch(''); setSearchQuery('');
                  setDetailFields({ orderNumber: '', customerName: '', phone: '', productName: '' });
                  setCommittedDetailFields(null);
                  setStatusFilters(new Set());
                  setPaymentMethodFilter('all'); setDateFrom(''); setDateTo(''); setPage(0);
                }}
                className="text-xs text-gray-400 hover:text-gray-700 underline"
              >
                전체 초기화
              </button>
            </div>
          );
        })()}
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
      ) : orders.length === 0 ? (
        <Card className="p-12 text-center text-gray-500">
          주문 내역이 없습니다.
        </Card>
      ) : (
        <Card>
          {/* 헤더 */}
          <div className="flex items-center gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-600">
            <input type="checkbox"
              checked={selectedIds.size === orders.length && orders.length > 0}
              onChange={toggleSelectAll} className="h-4 w-4 rounded" />
            {/* 주문번호 — 정렬 가능 */}
            <div className="w-36">
              <button
                className="flex items-center gap-1 hover:text-gray-900"
                onClick={() => {
                  if (sortField === 'order_number') setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
                  else { setSortField('order_number'); setSortDir('desc'); }
                  setPage(0);
                }}
              >
                주문번호
                {sortField === 'order_number'
                  ? (sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)
                  : <ChevronsUpDown className="h-3 w-3 text-gray-300" />}
              </button>
            </div>
            <div className="flex-1">고객정보</div>
            {columnOrder
              .filter((key) => visibleColumns.has(key))
              .map((key) => {
                if (key === 'product')   return <div key={key} className="w-48 min-w-0">상품 요약</div>;
                if (key === 'recipient') return <div key={key} className="w-24">수령인</div>;
                if (key === 'address')   return <div key={key} className="w-36 min-w-0">배송주소</div>;
                if (key === 'discount')  return <div key={key} className="w-28 text-right">할인/배송비</div>;
                return null;
              })}
            {/* 결제금액 — 정렬 가능 */}
            <div className="w-24 text-center">
              <button
                className="flex items-center gap-1 hover:text-gray-900 mx-auto"
                onClick={() => {
                  if (sortField === 'total_amount') setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
                  else { setSortField('total_amount'); setSortDir('desc'); }
                  setPage(0);
                }}
              >
                결제금액
                {sortField === 'total_amount'
                  ? (sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)
                  : <ChevronsUpDown className="h-3 w-3 text-gray-300" />}
              </button>
            </div>
            <div className="w-28 text-center">상태</div>
            {/* 주문일시 — 정렬 가능 */}
            <div className="w-24 text-center">
              <button
                className="flex items-center gap-1 hover:text-gray-900 mx-auto"
                onClick={() => {
                  if (sortField === 'created_at') setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
                  else { setSortField('created_at'); setSortDir('desc'); }
                  setPage(0);
                }}
              >
                주문일시
                {sortField === 'created_at'
                  ? (sortDir === 'desc' ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)
                  : <ChevronsUpDown className="h-3 w-3 text-gray-300" />}
              </button>
            </div>
            <div className="w-52 flex items-center justify-end gap-1">
              <span>액션</span>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 ml-1"
                onClick={() => setColumnPickerOpen(true)} title="컬럼 설정">
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="divide-y">
            {orders.map((order) => {
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

                  {/* 주문번호 */}
                  <div className="w-36 flex-shrink-0">
                    <p className="font-mono text-sm font-medium">{order.orderNumber}</p>
                    {order.isAdminOrder && (
                      <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 mt-0.5">
                        관리자
                      </span>
                    )}
                  </div>

                  {/* 고객정보 */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{order.customerName}</p>
                    <p className="text-xs text-gray-500">{order.customerPhone}</p>
                    {order.paymentMethod && (
                      <p className="text-xs text-gray-400">
                        {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
                      </p>
                    )}
                  </div>

                  {/* 선택 컬럼 — columnOrder 순서로 렌더링 */}
                  {columnOrder
                    .filter((key) => visibleColumns.has(key))
                    .map((key) => {
                      if (key === 'product') return (
                        <div key={key} className="w-48 min-w-0">
                          {order.productSummary ? (
                            <p className="text-xs text-gray-700 truncate" title={order.productSummary}>
                              {order.productSummary}
                            </p>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </div>
                      );
                      if (key === 'recipient') return (
                        <div key={key} className="w-24 flex-shrink-0">
                          <p className={`text-xs truncate ${order.recipientName !== order.customerName ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                            {order.recipientName || '—'}
                          </p>
                        </div>
                      );
                      if (key === 'address') return (
                        <div key={key} className="w-36 min-w-0">
                          <p className="text-xs text-gray-600 truncate" title={order.address}>
                            <MapPin className="inline h-3 w-3 mr-0.5 text-gray-400" />
                            {order.address || '—'}
                          </p>
                        </div>
                      );
                      if (key === 'discount') return (
                        <div key={key} className="w-28 flex-shrink-0 text-right">
                          {order.discountTotal > 0 && (
                            <p className="text-xs text-red-500">-{formatCurrency(order.discountTotal)}</p>
                          )}
                          <p className="text-xs text-gray-500">
                            {order.shippingFee === 0 ? '배송비 무료' : `배송비 ${formatCurrency(order.shippingFee)}`}
                          </p>
                        </div>
                      );
                      return null;
                    })}

                  {/* 결제금액 */}
                  <div className="w-24 text-center flex-shrink-0">
                    <p className="font-medium text-sm">{formatCurrency(order.totalAmount)}</p>
                    {visibleColumns.has('memo') && order.hasAdminMemo && (
                      <span title="관리자 메모 있음">
                        <MessageSquare className="inline h-3.5 w-3.5 text-yellow-500 mt-0.5" />
                      </span>
                    )}
                  </div>

                  {/* 상태 */}
                  <div className="w-28 text-center flex-shrink-0">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusColor}`}>
                      {ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}
                    </span>
                    {trackingUrl && (
                      <a href={trackingUrl} target="_blank" rel="noopener noreferrer"
                        className="mt-1 block text-xs text-blue-500 hover:underline">
                        배송조회
                      </a>
                    )}
                    {/* 입금마감 */}
                    {visibleColumns.has('deadline') && order.paymentDeadline &&
                      order.status === 'pending' &&
                      (order.paymentMethod === 'bank_transfer' || order.paymentMethod === 'virtual_account') && (() => {
                        const diff = new Date(order.paymentDeadline).getTime() - Date.now();
                        const isOverdue = diff < 0;
                        const isUrgent = !isOverdue && diff < 24 * 60 * 60 * 1000;
                        return (
                          <p className={`mt-0.5 text-[10px] ${isOverdue ? 'text-red-600 font-semibold' : isUrgent ? 'text-orange-500' : 'text-gray-400'}`}>
                            {isOverdue ? '마감초과' : `${format(new Date(order.paymentDeadline), 'MM/dd HH:mm')}까지`}
                          </p>
                        );
                      })()
                    }
                  </div>

                  {/* 주문일시 */}
                  <div className="w-24 text-center flex-shrink-0">
                    <p className="text-xs text-gray-500">{format(new Date(order.createdAt), 'MM/dd')}</p>
                    <p className="text-xs text-gray-400">{format(new Date(order.createdAt), 'HH:mm')}</p>
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

      {/* 컬럼 설정 Dialog */}
      <Dialog open={columnPickerOpen} onOpenChange={setColumnPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              컬럼 설정
            </DialogTitle>
          </DialogHeader>

          {/* 프리셋 버튼 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">프리셋</p>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(COLUMN_PRESETS).map(([key, preset]) => (
                <Button key={key} size="sm" variant="outline" onClick={() => applyPreset(key)}>
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 고정 컬럼 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1">고정 컬럼 (항상 표시)</p>
            <div className="space-y-0.5">
              {FIXED_COLUMNS.map((col) => (
                <div key={col.key}
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-400 bg-gray-50">
                  <input type="checkbox" checked disabled className="h-4 w-4 opacity-40 cursor-not-allowed" readOnly />
                  <span>{col.label}</span>
                  <Lock className="h-3 w-3 ml-auto text-gray-300" />
                </div>
              ))}
            </div>
          </div>

          {/* 선택 컬럼 — 순서 변경 가능 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">선택 컬럼 <span className="font-normal text-gray-400">(↑↓ 으로 순서 변경)</span></p>
            <div className="space-y-0.5">
              {columnOrder.map((key, index) => {
                const col = COLUMN_DEFS.find((c) => c.key === key)!;
                const isVisible = visibleColumns.has(key);
                return (
                  <div key={key}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-gray-50">
                    <input type="checkbox" checked={isVisible}
                      onChange={() => toggleColumn(key)} className="h-4 w-4 cursor-pointer" />
                    <span className={isVisible ? 'text-gray-800' : 'text-gray-400'}>{col.label}</span>
                    <div className="ml-auto flex gap-0.5">
                      <button onClick={() => moveColumn(index, -1)} disabled={index === 0}
                        className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-25 disabled:cursor-not-allowed">
                        <ChevronUp className="h-3.5 w-3.5 text-gray-500" />
                      </button>
                      <button onClick={() => moveColumn(index, 1)} disabled={index === columnOrder.length - 1}
                        className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-25 disabled:cursor-not-allowed">
                        <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 인디케이터 컬럼 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">
              셀 내 표시 항목 <span className="font-normal text-gray-400">(순서 변경 불가)</span>
            </p>
            <div className="space-y-0.5">
              {INDICATOR_DEFS.map((col) => {
                const isVisible = visibleColumns.has(col.key);
                return (
                  <div key={col.key}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-gray-50">
                    <input type="checkbox" checked={isVisible}
                      onChange={() => toggleColumn(col.key)} className="h-4 w-4 cursor-pointer" />
                    <span className={isVisible ? 'text-gray-800' : 'text-gray-400'}>{col.label}</span>
                    <span className="ml-auto text-[10px] text-gray-300">{col.description}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
