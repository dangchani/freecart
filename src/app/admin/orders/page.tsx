import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ShippingCompany {
  id: string;
  name: string;
  code: string;
}

interface Shipment {
  id: string;
  trackingNumber: string | null;
  shippingCompanyId: string | null;
  status: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  customerName: string;
  createdAt: string;
  shipment?: Shipment;
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: '결제 대기', variant: 'secondary' },
  paid: { label: '결제 완료', variant: 'default' },
  preparing: { label: '배송 준비중', variant: 'default' },
  shipping: { label: '배송중', variant: 'default' },
  delivered: { label: '배송 완료', variant: 'outline' },
  cancelled: { label: '취소됨', variant: 'destructive' },
};

const statusOptions = [
  { value: 'pending', label: '결제 대기' },
  { value: 'paid', label: '결제 완료' },
  { value: 'preparing', label: '배송 준비중' },
  { value: 'shipping', label: '배송중' },
  { value: 'delivered', label: '배송 완료' },
];

interface OrderStats {
  total: number;
  pending: number;
  paid: number;
  preparing: number;
  shipping: number;
  delivered: number;
  cancelled: number;
  totalAmount: number;
}

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // 배송사 목록
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
    total: 0,
    pending: 0,
    paid: 0,
    preparing: 0,
    shipping: 0,
    delivered: 0,
    cancelled: 0,
    totalAmount: 0,
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
  }>({ open: false, orderId: '', orderNumber: '', amount: 0 });

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth/login');
        return;
      }
      loadOrders();
      loadShippingCompanies();
    }
  }, [user, authLoading, navigate]);

  async function loadOrders() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount, orderer_name, orderer_phone, created_at, payment_method')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 각 주문에 대한 배송 정보 조회
      const orderIds = (data || []).map((o) => o.id);
      const { data: shipmentsData } = await supabase
        .from('shipments')
        .select('id, order_id, tracking_number, shipping_company_id, status')
        .in('order_id', orderIds);

      const shipmentMap = new Map<string, Shipment>();
      (shipmentsData || []).forEach((s: any) => {
        shipmentMap.set(s.order_id, {
          id: s.id,
          trackingNumber: s.tracking_number,
          shippingCompanyId: s.shipping_company_id,
          status: s.status,
        });
      });

      const orderList = (data || []).map((o: any) => ({
        id: o.id,
        orderNumber: o.order_number,
        status: o.status,
        totalAmount: o.total_amount,
        customerName: o.orderer_name,
        customerPhone: o.orderer_phone,
        paymentMethod: o.payment_method,
        createdAt: o.created_at,
        shipment: shipmentMap.get(o.id),
      }));

      setOrders(orderList);

      // 통계 계산
      const newStats: OrderStats = {
        total: orderList.length,
        pending: 0,
        paid: 0,
        preparing: 0,
        shipping: 0,
        delivered: 0,
        cancelled: 0,
        totalAmount: 0,
      };

      orderList.forEach((order) => {
        if (order.status in newStats) {
          (newStats as any)[order.status]++;
        }
        if (order.status !== 'cancelled') {
          newStats.totalAmount += order.totalAmount;
        }
      });

      setStats(newStats);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  }

  // 필터링된 주문 목록
  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      !searchQuery ||
      order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    const orderDate = new Date(order.createdAt);
    const matchesDateFrom = !dateFrom || orderDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || orderDate <= new Date(dateTo + 'T23:59:59');

    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  // 전체 선택/해제
  function toggleSelectAll() {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
    }
  }

  // 개별 선택
  function toggleSelect(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  }

  // 일괄 상태 변경
  async function handleBulkStatusChange(newStatus: string) {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개 주문의 상태를 변경하시겠습니까?`)) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      setSelectedIds(new Set());
      await loadOrders();
      alert('주문 상태가 변경되었습니다.');
    } catch (error) {
      console.error('Failed to bulk update:', error);
      alert('일괄 변경 중 오류가 발생했습니다.');
    }
  }

  // CSV 내보내기
  async function handleExport() {
    const headers = ['주문번호', '주문일시', '고객명', '전화번호', '결제방법', '금액', '상태', '운송장번호'];
    const rows = filteredOrders.map((order) => [
      order.orderNumber,
      format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm'),
      order.customerName,
      (order as any).customerPhone || '',
      (order as any).paymentMethod || '',
      order.totalAmount,
      statusLabels[order.status]?.label || order.status,
      order.shipment?.trackingNumber || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orders_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // 입금 확인 처리
  async function handleConfirmDeposit() {
    try {
      const supabase = createClient();

      // 주문 상태를 결제 완료로 변경
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', depositModal.orderId);

      if (error) throw error;

      // 가상계좌 상태도 업데이트
      await supabase
        .from('order_virtual_accounts')
        .update({
          status: 'deposited',
          deposited_at: new Date().toISOString(),
        })
        .eq('order_id', depositModal.orderId);

      setDepositModal({ open: false, orderId: '', orderNumber: '', amount: 0 });
      await loadOrders();
      alert('입금이 확인되었습니다.');
    } catch (error) {
      console.error('Failed to confirm deposit:', error);
      alert('입금 확인 처리 중 오류가 발생했습니다.');
    }
  }

  async function loadShippingCompanies() {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('shipping_companies')
        .select('id, name, code')
        .eq('is_active', true)
        .order('sort_order');

      setShippingCompanies(
        (data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          code: c.code,
        }))
      );
    } catch (error) {
      console.error('Failed to load shipping companies:', error);
    }
  }

  async function handleStatusChange(orderId: string, newStatus: string) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      await loadOrders();
    } catch (error) {
      console.error('Failed to update order status:', error);
      alert(error instanceof Error ? error.message : '주문 상태 변경 중 오류가 발생했습니다.');
    }
  }

  function openShipmentModal(order: Order) {
    setShipmentModal({
      open: true,
      orderId: order.id,
      trackingNumber: order.shipment?.trackingNumber || '',
      shippingCompanyId: order.shipment?.shippingCompanyId || '',
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

      if (shipmentModal.existingShipmentId) {
        // 기존 배송 정보 업데이트
        const { error } = await supabase
          .from('shipments')
          .update({
            shipping_company_id: shipmentModal.shippingCompanyId,
            tracking_number: shipmentModal.trackingNumber,
            status: 'shipping',
            shipped_at: new Date().toISOString(),
          })
          .eq('id', shipmentModal.existingShipmentId);

        if (error) throw error;
      } else {
        // 새 배송 정보 등록
        const { error } = await supabase
          .from('shipments')
          .insert({
            order_id: shipmentModal.orderId,
            shipping_company_id: shipmentModal.shippingCompanyId,
            tracking_number: shipmentModal.trackingNumber,
            status: 'shipping',
            shipped_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      // 주문 상태도 '배송중'으로 변경
      await supabase
        .from('orders')
        .update({ status: 'shipping' })
        .eq('id', shipmentModal.orderId);

      setShipmentModal({ open: false, orderId: '', trackingNumber: '', shippingCompanyId: '' });
      await loadOrders();
      alert('운송장이 등록되었습니다.');
    } catch (error) {
      console.error('Failed to save shipment:', error);
      alert('운송장 등록 중 오류가 발생했습니다.');
    } finally {
      setSavingShipment(false);
    }
  }

  if (authLoading || loading) {
    return <div className="container py-8">로딩 중...</div>;
  }

  return (
    <div className="container py-8">
      <Link to="/admin" className="mb-6 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="mr-1 h-4 w-4" />
        대시보드로 돌아가기
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">주문 관리</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadOrders()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            새로고침
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            내보내기
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="p-4 text-center">
          <p className="text-sm text-gray-500">전체</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-4 text-center bg-yellow-50 border-yellow-200">
          <p className="text-sm text-yellow-700">결제 대기</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
        </Card>
        <Card className="p-4 text-center bg-green-50 border-green-200">
          <p className="text-sm text-green-700">결제 완료</p>
          <p className="text-2xl font-bold text-green-700">{stats.paid}</p>
        </Card>
        <Card className="p-4 text-center bg-blue-50 border-blue-200">
          <p className="text-sm text-blue-700">배송 준비</p>
          <p className="text-2xl font-bold text-blue-700">{stats.preparing}</p>
        </Card>
        <Card className="p-4 text-center bg-purple-50 border-purple-200">
          <p className="text-sm text-purple-700">배송중</p>
          <p className="text-2xl font-bold text-purple-700">{stats.shipping}</p>
        </Card>
        <Card className="p-4 text-center bg-gray-50">
          <p className="text-sm text-gray-500">배송 완료</p>
          <p className="text-2xl font-bold">{stats.delivered}</p>
        </Card>
        <Card className="p-4 text-center bg-red-50 border-red-200">
          <p className="text-sm text-red-700">취소</p>
          <p className="text-2xl font-bold text-red-700">{stats.cancelled}</p>
        </Card>
      </div>

      {/* 필터 */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="주문번호 또는 고객명 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
              <SelectItem value="cancelled">취소됨</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[150px]"
            placeholder="시작일"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[150px]"
            placeholder="종료일"
          />
        </div>
      </Card>

      {/* 선택된 항목 액션바 */}
      {selectedIds.size > 0 && (
        <Card className="mb-4 p-3 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-700">
              {selectedIds.size}개 주문 선택됨
            </span>
            <div className="flex gap-2">
              <Select onValueChange={handleBulkStatusChange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="상태 변경" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
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

      {filteredOrders.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500">
            {orders.length === 0 ? '주문 내역이 없습니다.' : '검색 결과가 없습니다.'}
          </p>
        </Card>
      ) : (
        <Card>
          {/* 테이블 헤더 */}
          <div className="flex items-center gap-4 p-4 border-b bg-gray-50">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredOrders.length && filteredOrders.length > 0}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded"
            />
            <div className="w-32 font-medium text-sm text-gray-600">주문번호</div>
            <div className="flex-1 font-medium text-sm text-gray-600">고객정보</div>
            <div className="w-24 text-center font-medium text-sm text-gray-600">금액</div>
            <div className="w-24 text-center font-medium text-sm text-gray-600">상태</div>
            <div className="w-48"></div>
          </div>

          <div className="divide-y">
            {filteredOrders.map((order) => {
              const statusInfo = statusLabels[order.status] || { label: order.status, variant: 'default' as const };

              return (
                <div key={order.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(order.id)}
                    onChange={() => toggleSelect(order.id)}
                    className="h-4 w-4 rounded"
                  />
                  <div className="w-32">
                    <p className="font-mono text-sm font-medium">{order.orderNumber}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(order.createdAt), 'MM/dd HH:mm')}
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{order.customerName}</p>
                    {(order as any).paymentMethod && (
                      <p className="text-xs text-gray-500">
                        {(order as any).paymentMethod === 'card' && '카드결제'}
                        {(order as any).paymentMethod === 'virtual_account' && '가상계좌'}
                        {(order as any).paymentMethod === 'bank_transfer' && '무통장입금'}
                      </p>
                    )}
                  </div>
                  <div className="w-24 text-center">
                    <p className="font-medium">{formatCurrency(order.totalAmount)}</p>
                  </div>
                  <div className="w-24 text-center">
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </div>
                  <div className="flex gap-1 w-48 justify-end">
                    {order.status === 'pending' && (order as any).paymentMethod !== 'card' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setDepositModal({
                            open: true,
                            orderId: order.id,
                            orderNumber: order.orderNumber,
                            amount: order.totalAmount,
                          })
                        }
                        title="입금 확인"
                      >
                        <CreditCard className="h-4 w-4" />
                      </Button>
                    )}
                    <Select
                      value={order.status}
                      onValueChange={(value) => handleStatusChange(order.id, value)}
                    >
                      <SelectTrigger className="w-28 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openShipmentModal(order)}
                      title="운송장"
                    >
                      <Truck className="h-4 w-4" />
                    </Button>
                    <Link to={`/mypage/orders/${order.orderNumber}`}>
                      <Button size="sm" variant="ghost" title="상세">
                        상세
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 운송장 등록 모달 */}
      {shipmentModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">운송장 등록</h2>
              <button
                onClick={() => setShipmentModal({ open: false, orderId: '', trackingNumber: '', shippingCompanyId: '' })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="shippingCompany">배송사</Label>
                <Select
                  value={shipmentModal.shippingCompanyId}
                  onValueChange={(value) =>
                    setShipmentModal((prev) => ({ ...prev, shippingCompanyId: value }))
                  }
                >
                  <SelectTrigger id="shippingCompany" className="mt-1">
                    <SelectValue placeholder="배송사 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {shippingCompanies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="trackingNumber">운송장 번호</Label>
                <Input
                  id="trackingNumber"
                  value={shipmentModal.trackingNumber}
                  onChange={(e) =>
                    setShipmentModal((prev) => ({ ...prev, trackingNumber: e.target.value }))
                  }
                  placeholder="운송장 번호 입력"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShipmentModal({ open: false, orderId: '', trackingNumber: '', shippingCompanyId: '' })}
              >
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
              <button
                onClick={() => setDepositModal({ open: false, orderId: '', orderNumber: '', amount: 0 })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">주문번호</p>
                <p className="font-mono font-bold">{depositModal.orderNumber}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600">입금 금액</p>
                <p className="text-xl font-bold text-blue-700">
                  {formatCurrency(depositModal.amount)}
                </p>
              </div>
              <p className="text-sm text-gray-500">
                위 금액이 입금되었음을 확인하셨나요?
                입금 확인 시 주문 상태가 "결제 완료"로 변경됩니다.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDepositModal({ open: false, orderId: '', orderNumber: '', amount: 0 })}
              >
                취소
              </Button>
              <Button onClick={handleConfirmDeposit}>
                <Check className="mr-2 h-4 w-4" />
                입금 확인
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
