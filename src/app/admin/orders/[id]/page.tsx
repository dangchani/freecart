import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { format, addDays } from 'date-fns';
import {
  ArrowLeft,
  Printer,
  FileText,
  ExternalLink,
  Check,
  X,
  Truck,
  Clock,
  User,
  MapPin,
  CreditCard,
  Package,
  MessageSquare,
  AlertTriangle,
  Edit2,
  Plus,
  Minus,
  Trash2,
  Search,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_TRANSITIONS,
  ORDER_ITEM_STATUS_LABELS,
  ORDER_ITEM_STATUS_COLORS,
  ORDER_RETURNABLE_STATUSES,
  isValidTransition,
  type OrderStatus,
  type OrderItemStatus,
} from '@/constants/orderStatus';
import { transitionOrderStatus, getOrderTimeline, updateOrderShipping, updateOrderItems } from '@/services/orders';
import { createAdminReturn, RETURN_REASONS } from '@/services/returns';
import type { ReturnItem } from '@/services/returns';
import { createAdminExchange, calculatePriceDiff, EXCHANGE_REASONS } from '@/services/exchanges';
import type { ExchangeItem } from '@/services/exchanges';
import { reissueCashReceipt } from '@/services/cashReceipt';
import { reissueTaxInvoice } from '@/services/taxInvoice';
import type { OrderTimeline } from '@/types';

const AUTO_CONFIRM_DAYS = 7;

interface OrderDetail {
  id: string;
  orderNumber: string;
  userId: string | null;
  status: string;
  ordererName: string;
  ordererPhone: string;
  ordererEmail: string | null;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;
  address2: string | null;
  shippingMessage: string | null;
  subtotal: number;
  discountAmount: number;
  couponDiscount: number;
  shippingFee: number;
  usedPoints: number;
  usedDeposit: number;
  totalAmount: number;
  returnedAmount: number;
  earnedPoints: number;
  paymentMethod: string | null;
  pgProvider: string | null;
  paidAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  isGift: boolean;
  giftMessage: string | null;
  adminMemo: string | null;
  paymentDeadline: string | null;
  autoConfirmAt: string | null;
  createdAt: string;
  coupon: { id: string; name: string } | null;
  items: OrderItem[];
}

interface OrderItem {
  id: string;
  productId: string;
  variantId: string | null;
  productName: string;
  optionText: string | null;
  productImage: string | null;
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  totalPrice: number;
  status: string;
  itemType: string;
  returnedQuantity: number;
  exchangedQuantity: number;
}

interface Shipment {
  id: string;
  trackingNumber: string | null;
  shippingCompanyId: string | null;
  status: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  company: { id: string; name: string; trackingUrl: string | null } | null;
}

interface Payment {
  id: string;
  method: string;
  amount: number;
  status: string;
  pgProvider: string;
  receiptUrl: string | null;
  paidAt: string | null;
}

interface VirtualAccount {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  holderName: string;
  amount: number;
  expiresAt: string;
  status: string;
  depositedAt: string | null;
}

interface AdminMemo {
  id: string;
  content: string;
  adminId: string | null;
  createdAt: string;
}

interface ReturnRequest {
  id: string;
  reason: string;
  status: string;
  refundAmount: number;
  initiatedBy: 'customer' | 'admin';
  createdAt: string;
}

interface ExchangeRequest {
  id: string;
  reason: string;
  status: string;
  priceDiff: number;
  initiatedBy: 'customer' | 'admin';
  createdAt: string;
}

interface CashReceiptInfo {
  id: string;
  receiptType: string;
  identifier: string;
  amount: number;
  status: string;
  issuedAt: string | null;
}

interface TaxInvoiceInfo {
  id: string;
  businessName: string;
  businessNumber: string;
  totalAmount: number;
  status: string;
}

interface ShippingCompany {
  id: string;
  name: string;
  trackingUrl: string | null;
}

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [vbank, setVbank] = useState<VirtualAccount | null>(null);
  const [timeline, setTimeline] = useState<OrderTimeline[]>([]);
  const [memos, setMemos] = useState<AdminMemo[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [exchanges, setExchanges] = useState<ExchangeRequest[]>([]);
  const [cashReceipts, setCashReceipts] = useState<CashReceiptInfo[]>([]);
  const [taxInvoices, setTaxInvoices] = useState<TaxInvoiceInfo[]>([]);
  const [shippingCompanies, setShippingCompanies] = useState<ShippingCompany[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 송장 입력
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingCompanyId, setShippingCompanyId] = useState('');
  const [shipmentHighlight, setShipmentHighlight] = useState(false);
  const shipmentRef = useRef<HTMLDivElement>(null);

  // 메모 입력
  const [memoInput, setMemoInput] = useState('');

  // 취소 모달
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // 부분 취소
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [partialCancelModal, setPartialCancelModal] = useState(false);
  const [partialCancelReason, setPartialCancelReason] = useState('');

  // 배송지 수정 모달
  const [shippingEditModal, setShippingEditModal] = useState(false);
  const [shippingEdit, setShippingEdit] = useState({
    ordererName: '', ordererPhone: '',
    recipientName: '', recipientPhone: '',
    postalCode: '', address1: '', address2: '', shippingMessage: '',
  });

  // 상품 수정 모달
  const [itemEditModal, setItemEditModal] = useState(false);
  type EditItem = { id?: string; productId: string; variantId: string | null; productName: string; optionText: string; unitPrice: number; quantity: number; itemType: string; };
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [productSearchQ, setProductSearchQ] = useState('');
  const [productSearchResults, setProductSearchResults] = useState<Array<{ id: string; name: string; price: number; stock: number; }>>([]);
  const [variantResults, setVariantResults] = useState<Array<{ id: string; optionText: string; price: number; additionalPrice: number; stock: number; }>>([]);
  const [selectedProductForAdd, setSelectedProductForAdd] = useState<{ id: string; name: string; price: number } | null>(null);

  // 반품 모달
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnTargetItem, setReturnTargetItem] = useState<OrderItem | null>(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState('');
  const [returnDescription, setReturnDescription] = useState('');
  const [returnRefundPreview, setReturnRefundPreview] = useState(0);

  // 교환 모달
  const [exchangeModalOpen, setExchangeModalOpen] = useState(false);
  const [exchangeTargetItem, setExchangeTargetItem] = useState<OrderItem | null>(null);
  const [exchangeStep, setExchangeStep] = useState<1 | 2>(1);
  const [exchangeQty, setExchangeQty] = useState(1);
  const [exchangeReason, setExchangeReason] = useState('');
  const [exchangeSearchQ, setExchangeSearchQ] = useState('');
  const [exchangeSearchResults, setExchangeSearchResults] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [exchangeSelectedProduct, setExchangeSelectedProduct] = useState<{ id: string; name: string; price: number } | null>(null);
  const [exchangeVariantResults, setExchangeVariantResults] = useState<Array<{ id: string; optionText: string; price: number }>>([]);
  const [exchangeSelectedVariant, setExchangeSelectedVariant] = useState<{ id: string; optionText: string; price: number } | null>(null);
  const [exchangePriceDiff, setExchangePriceDiff] = useState(0);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate('/auth/login'); return; }
      if (id) loadAll(id);
    }
  }, [user, authLoading, id]);

  async function loadAll(orderId: string) {
    try {
      setLoading(true);
      const supabase = createClient();

      const [
        { data: orderData },
        { data: shipmentData },
        { data: paymentsData },
        { data: vbankData },
        timelineData,
        { data: memosData },
        { data: returnsData },
        { data: exchangesData },
        { data: cashData },
        { data: taxData },
        { data: companies },
      ] = await Promise.all([
        supabase.from('orders').select(`
          *, items:order_items(*),
          coupon:coupons(id, name)
        `).eq('id', orderId).single(),

        supabase.from('shipments').select(`
          *, company:shipping_companies(id, name, tracking_url)
        `).eq('order_id', orderId).maybeSingle(),

        supabase.from('payments').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),

        supabase.from('order_virtual_accounts').select('*').eq('order_id', orderId).maybeSingle(),

        getOrderTimeline(orderId),

        supabase.from('order_memos').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),

        supabase.from('returns').select('id, reason, status, refund_amount, initiated_by, created_at').eq('order_id', orderId).order('created_at', { ascending: false }),
        supabase.from('exchanges').select('id, reason, status, price_diff, initiated_by, created_at').eq('order_id', orderId).order('created_at', { ascending: false }),

        supabase.from('cash_receipts').select('id, receipt_type, identifier, amount, status, issued_at').eq('order_id', orderId),
        supabase.from('tax_invoices').select('id, business_name, business_number, total_amount, status').eq('order_id', orderId),

        supabase.from('shipping_companies').select('id, name, tracking_url').eq('is_active', true).order('sort_order'),
      ]);

      if (orderData) {
        setOrder({
          id: orderData.id,
          orderNumber: orderData.order_number,
          userId: orderData.user_id,
          status: orderData.status,
          ordererName: orderData.orderer_name,
          ordererPhone: orderData.orderer_phone,
          ordererEmail: orderData.orderer_email,
          recipientName: orderData.recipient_name,
          recipientPhone: orderData.recipient_phone,
          postalCode: orderData.postal_code,
          address1: orderData.address1,
          address2: orderData.address2,
          shippingMessage: orderData.shipping_message,
          subtotal: orderData.subtotal,
          discountAmount: orderData.discount_amount ?? 0,
          couponDiscount: orderData.coupon_discount ?? 0,
          shippingFee: orderData.shipping_fee ?? 0,
          usedPoints: orderData.used_points ?? 0,
          usedDeposit: orderData.used_deposit ?? 0,
          totalAmount: orderData.total_amount,
          earnedPoints: orderData.earned_points ?? 0,
          paymentMethod: orderData.payment_method,
          pgProvider: orderData.pg_provider,
          paidAt: orderData.paid_at,
          confirmedAt: orderData.confirmed_at,
          cancelledAt: orderData.cancelled_at,
          cancelReason: orderData.cancel_reason,
          isGift: orderData.is_gift ?? false,
          giftMessage: orderData.gift_message,
          adminMemo: orderData.admin_memo,
          paymentDeadline: orderData.payment_deadline,
          autoConfirmAt: orderData.auto_confirm_at,
          createdAt: orderData.created_at,
          returnedAmount: orderData.returned_amount ?? 0,
          coupon: orderData.coupon ?? null,
          items: (orderData.items ?? []).map((item: any) => ({
            id: item.id,
            productId: item.product_id,
            variantId: item.variant_id,
            productName: item.product_name,
            optionText: item.option_text,
            productImage: item.product_image,
            unitPrice: item.unit_price,
            quantity: item.quantity,
            discountAmount: item.discount_amount ?? 0,
            totalPrice: item.total_price,
            status: item.status,
            itemType: item.item_type ?? 'purchase',
            returnedQuantity:  item.returned_quantity  ?? 0,
            exchangedQuantity: item.exchanged_quantity ?? 0,
          })),
        });
      }

      if (shipmentData) {
        setShipment({
          id: shipmentData.id,
          trackingNumber: shipmentData.tracking_number,
          shippingCompanyId: shipmentData.shipping_company_id,
          status: shipmentData.status,
          shippedAt: shipmentData.shipped_at,
          deliveredAt: shipmentData.delivered_at,
          company: shipmentData.company ?? null,
        });
        setTrackingNumber(shipmentData.tracking_number ?? '');
        setShippingCompanyId(shipmentData.shipping_company_id ?? '');
      }

      setPayments((paymentsData ?? []).map((p: any) => ({
        id: p.id, method: p.method, amount: p.amount, status: p.status,
        pgProvider: p.pg_provider, receiptUrl: p.receipt_url, paidAt: p.paid_at,
      })));

      if (vbankData) {
        setVbank({
          bankCode: vbankData.bank_code, bankName: vbankData.bank_name,
          accountNumber: vbankData.account_number, holderName: vbankData.holder_name,
          amount: vbankData.amount, expiresAt: vbankData.expires_at,
          status: vbankData.status, depositedAt: vbankData.deposited_at,
        });
      }

      setTimeline(timelineData);
      setMemos((memosData ?? []).map((m: any) => ({ id: m.id, content: m.content, adminId: m.admin_id, createdAt: m.created_at })));
      setReturns((returnsData ?? []).map((r: any) => ({ id: r.id, reason: r.reason, status: r.status, refundAmount: r.refund_amount ?? 0, initiatedBy: r.initiated_by ?? 'customer', createdAt: r.created_at })));
      setExchanges((exchangesData ?? []).map((e: any) => ({ id: e.id, reason: e.reason, status: e.status, priceDiff: e.price_diff ?? 0, initiatedBy: e.initiated_by ?? 'customer', createdAt: e.created_at })));
      setCashReceipts((cashData ?? []).map((c: any) => ({ id: c.id, receiptType: c.receipt_type, identifier: c.identifier, amount: c.amount, status: c.status, issuedAt: c.issued_at })));
      setTaxInvoices((taxData ?? []).map((t: any) => ({ id: t.id, businessName: t.business_name, businessNumber: t.business_number, totalAmount: t.total_amount, status: t.status })));
      setShippingCompanies((companies ?? []).map((c: any) => ({ id: c.id, name: c.name, trackingUrl: c.tracking_url })));
    } catch (err) {
      console.error('Failed to load order detail:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleTransition(toStatus: OrderStatus) {
    if (!order || !id) return;
    if (toStatus === 'shipped' && !trackingNumber) {
      setShipmentHighlight(true);
      shipmentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      alert('배송중 처리 전 운송장 번호를 먼저 입력해주세요.');
      return;
    }
    if (toStatus === 'cancelled') { setCancelModal(true); return; }

    setSaving(true);
    try {
      const supabase = createClient();
      await transitionOrderStatus(id, toStatus, { changedBy: user?.id });

      if (toStatus === 'delivered') {
        const autoConfirmAt = addDays(new Date(), AUTO_CONFIRM_DAYS).toISOString();
        await supabase.from('orders').update({ auto_confirm_at: autoConfirmAt }).eq('id', id);
      }

      await loadAll(id);
    } catch (err: any) {
      alert(err.message ?? '상태 변경 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelConfirm() {
    if (!order || !id || !cancelReason.trim()) { alert('취소 사유를 입력해주세요.'); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      await transitionOrderStatus(id, 'cancelled', { note: cancelReason, changedBy: user?.id });
      await supabase.from('orders').update({ cancel_reason: cancelReason }).eq('id', id);
      setCancelModal(false);
      setCancelReason('');
      await loadAll(id);
    } catch (err: any) {
      alert(err.message ?? '취소 처리 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveShipment() {
    if (!trackingNumber || !shippingCompanyId) { alert('배송사와 운송장 번호를 모두 입력해주세요.'); return; }
    if (!id || !order) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        shipping_company_id: shippingCompanyId,
        tracking_number: trackingNumber,
        status: 'shipped',
        shipped_at: new Date().toISOString(),
      };
      if (shipment) {
        await supabase.from('shipments').update(payload).eq('id', shipment.id);
      } else {
        await supabase.from('shipments').insert({ order_id: id, ...payload });
      }
      if (isValidTransition(order.status as OrderStatus, 'shipped')) {
        await transitionOrderStatus(id, 'shipped', { note: `운송장: ${trackingNumber}`, changedBy: user?.id });
      }
      setShipmentHighlight(false);
      await loadAll(id);
      alert('운송장이 저장되었습니다.');
    } catch (err: any) {
      alert(err.message ?? '운송장 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMemo() {
    if (!memoInput.trim() || !id) return;
    const supabase = createClient();
    await supabase.from('order_memos').insert({ order_id: id, admin_id: user?.id ?? null, content: memoInput.trim() });
    setMemoInput('');
    const { data } = await supabase.from('order_memos').select('*').eq('order_id', id).order('created_at', { ascending: false });
    setMemos((data ?? []).map((m: any) => ({ id: m.id, content: m.content, adminId: m.admin_id, createdAt: m.created_at })));
  }

  async function handlePartialCancel() {
    if (!order || !id || selectedItemIds.size === 0 || !partialCancelReason.trim()) return;
    setSaving(true);
    try {
      const { executeFullCancel } = await import('@/services/refundOrchestrator');
      const items = order.items
        .filter((item) => selectedItemIds.has(item.id))
        .map((item) => ({ orderItemId: item.id, quantity: item.quantity }));
      const result = await executeFullCancel(id, partialCancelReason, user?.id, items);
      if (!result.success) {
        alert(result.error ?? '부분 취소 처리 중 오류가 발생했습니다.');
        return;
      }
      setPartialCancelModal(false);
      setPartialCancelReason('');
      setSelectedItemIds(new Set());
      await loadAll(id);
      alert('선택한 상품이 취소되었습니다.');
    } catch (err: any) {
      alert(err.message ?? '부분 취소 처리 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  function openShippingEdit() {
    if (!order) return;
    setShippingEdit({
      ordererName:     order.ordererName,
      ordererPhone:    order.ordererPhone,
      recipientName:   order.recipientName,
      recipientPhone:  order.recipientPhone,
      postalCode:      order.postalCode,
      address1:        order.address1,
      address2:        order.address2 ?? '',
      shippingMessage: order.shippingMessage ?? '',
    });
    setShippingEditModal(true);
  }

  async function handleSaveShippingEdit() {
    if (!id || !order) return;
    setSaving(true);
    try {
      await updateOrderShipping(id, shippingEdit, user?.id);
      setShippingEditModal(false);
      await loadAll(id);
      alert('배송지가 수정되었습니다.');
    } catch (err: any) {
      alert(err.message ?? '배송지 수정 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  function openItemEdit() {
    if (!order) return;
    setEditItems(order.items.map((i) => ({
      id:          i.id,
      productId:   i.productId,
      variantId:   i.variantId ?? null,
      productName: i.productName,
      optionText:  i.optionText ?? '',
      unitPrice:   i.unitPrice,
      quantity:    i.quantity,
      itemType:    i.itemType,
    })));
    setProductSearchQ('');
    setProductSearchResults([]);
    setSelectedProductForAdd(null);
    setVariantResults([]);
    setItemEditModal(true);
  }

  async function handleProductSearch() {
    if (!productSearchQ.trim()) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('products')
      .select('id, name, price, stock_quantity')
      .ilike('name', `%${productSearchQ.trim()}%`)
      .eq('is_active', true)
      .limit(10);
    setProductSearchResults((data ?? []).map((p: any) => ({
      id: p.id, name: p.name, price: p.price, stock: p.stock_quantity ?? 0,
    })));
  }

  async function handleSelectProduct(p: { id: string; name: string; price: number }) {
    setSelectedProductForAdd(p);
    const supabase = createClient();
    const { data } = await supabase
      .from('product_variants')
      .select('id, option_text, price, additional_price, stock_quantity')
      .eq('product_id', p.id)
      .eq('is_active', true);
    setVariantResults((data ?? []).map((v: any) => ({
      id: v.id, optionText: v.option_text, price: v.price, additionalPrice: v.additional_price ?? 0, stock: v.stock_quantity ?? 0,
    })));
    if (!data || data.length === 0) {
      // 옵션 없는 상품 바로 추가
      setEditItems((prev) => [...prev, {
        productId: p.id, variantId: null,
        productName: p.name, optionText: '',
        unitPrice: p.price, quantity: 1, itemType: 'purchase',
      }]);
      setSelectedProductForAdd(null);
      setProductSearchQ('');
      setProductSearchResults([]);
    }
  }

  function handleSelectVariant(v: { id: string; optionText: string; price: number; additionalPrice: number }) {
    if (!selectedProductForAdd) return;
    setEditItems((prev) => [...prev, {
      productId:   selectedProductForAdd.id,
      variantId:   v.id,
      productName: selectedProductForAdd.name,
      optionText:  v.optionText,
      unitPrice:   v.price || selectedProductForAdd.price + v.additionalPrice,
      quantity:    1,
      itemType:    'purchase',
    }]);
    setSelectedProductForAdd(null);
    setVariantResults([]);
    setProductSearchQ('');
    setProductSearchResults([]);
  }

  async function handleSaveItemEdit() {
    if (!id || !order) return;
    if (editItems.filter((i) => i.itemType !== 'gift').length === 0) {
      alert('구매 상품이 최소 1개 이상이어야 합니다.');
      return;
    }
    setSaving(true);
    try {
      await updateOrderItems(id, editItems, user?.id);
      setItemEditModal(false);
      await loadAll(id);
      alert('상품이 수정되었습니다.');
    } catch (err: any) {
      alert(err.message ?? '상품 수정 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  // ── 반품 핸들러 ──────────────────────────────────────────────────────────────
  function openReturnModal(item: OrderItem) {
    const availableQty = item.quantity - item.returnedQuantity - item.exchangedQuantity;
    setReturnTargetItem(item);
    setReturnQty(Math.min(1, availableQty));
    setReturnReason('');
    setReturnDescription('');
    const propDiscount = Math.floor(item.discountAmount * 1 / item.quantity);
    setReturnRefundPreview(item.unitPrice * 1 - propDiscount);
    setReturnModalOpen(true);
  }

  function handleReturnQtyChange(qty: number) {
    if (!returnTargetItem) return;
    const availableQty = returnTargetItem.quantity - returnTargetItem.returnedQuantity - returnTargetItem.exchangedQuantity;
    const clamped = Math.max(1, Math.min(qty, availableQty));
    setReturnQty(clamped);
    const propDiscount = Math.floor(returnTargetItem.discountAmount * clamped / returnTargetItem.quantity);
    setReturnRefundPreview(returnTargetItem.unitPrice * clamped - propDiscount);
  }

  async function handleSubmitReturn() {
    if (!order || !returnTargetItem || !returnReason || !id) return;
    setSaving(true);
    try {
      const result = await createAdminReturn({
        orderId:     order.id,
        adminId:     user!.id,
        items:       [{ order_item_id: returnTargetItem.id, quantity: returnQty }],
        reason:      returnReason,
        description: returnDescription || undefined,
      });
      if (!result.success) { alert(result.error ?? '반품 처리 중 오류가 발생했습니다.'); return; }
      setReturnModalOpen(false);
      await loadAll(id);
      alert(`반품 처리 완료. 환불금액: ${formatCurrency(result.refundAmount ?? 0)}`);
    } catch (err: any) {
      alert(err.message ?? '반품 처리 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  // ── 교환 핸들러 ──────────────────────────────────────────────────────────────
  function openExchangeModal(item: OrderItem) {
    const availableQty = item.quantity - item.returnedQuantity - item.exchangedQuantity;
    setExchangeTargetItem(item);
    setExchangeStep(1);
    setExchangeQty(Math.min(1, availableQty));
    setExchangeReason('');
    setExchangeSearchQ('');
    setExchangeSearchResults([]);
    setExchangeSelectedProduct(null);
    setExchangeVariantResults([]);
    setExchangeSelectedVariant(null);
    setExchangePriceDiff(0);
    setExchangeModalOpen(true);
  }

  async function handleExchangeProductSearch() {
    if (!exchangeSearchQ.trim()) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('products')
      .select('id, name, price, stock_quantity')
      .ilike('name', `%${exchangeSearchQ.trim()}%`)
      .eq('is_active', true)
      .limit(10);
    setExchangeSearchResults((data ?? []).map((p: any) => ({ id: p.id, name: p.name, price: p.price })));
  }

  async function handleExchangeSelectProduct(p: { id: string; name: string; price: number }) {
    setExchangeSelectedProduct(p);
    setExchangeSelectedVariant(null);
    const supabase = createClient();
    const { data } = await supabase
      .from('product_variants')
      .select('id, option_text, price')
      .eq('product_id', p.id)
      .eq('is_active', true);
    setExchangeVariantResults((data ?? []).map((v: any) => ({ id: v.id, optionText: v.option_text, price: v.price })));
  }

  async function handleExchangeSelectVariant(v: { id: string; optionText: string; price: number }) {
    setExchangeSelectedVariant(v);
    if (exchangeTargetItem) {
      const { priceDiff } = await calculatePriceDiff(exchangeTargetItem.unitPrice, v.id, exchangeQty);
      setExchangePriceDiff(priceDiff);
    }
  }

  async function handleSubmitExchange() {
    if (!order || !exchangeTargetItem || !exchangeReason || !exchangeSelectedVariant || !id) return;
    if (!exchangeSelectedVariant.id) { alert('교환할 상품의 옵션을 선택해주세요.'); return; }
    setSaving(true);
    try {
      const result = await createAdminExchange({
        orderId:  order.id,
        adminId:  user!.id,
        items:    [{ order_item_id: exchangeTargetItem.id, quantity: exchangeQty, exchange_variant_id: exchangeSelectedVariant.id }],
        reason:   exchangeReason,
      });
      if (!result.success) { alert(result.error ?? '교환 처리 중 오류가 발생했습니다.'); return; }
      setExchangeModalOpen(false);
      await loadAll(id);
      const diffMsg = result.priceDiff !== 0 ? `\n가격 차이: ${formatCurrency(result.priceDiff ?? 0)}` : '';
      alert(`교환 처리가 완료되었습니다.${diffMsg}`);
    } catch (err: any) {
      alert(err.message ?? '교환 처리 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  // ── 재발급 핸들러 ────────────────────────────────────────────────────────────
  async function handleReissueCashReceipt(receiptId: string) {
    if (!order || !id) return;
    const newAmount = order.totalAmount - order.returnedAmount;
    if (!confirm(`현금영수증을 ${formatCurrency(newAmount)}으로 재발급 요청하시겠습니까?`)) return;
    setSaving(true);
    try {
      const result = await reissueCashReceipt(receiptId, newAmount, order.id);
      if (!result.success) { alert(result.error ?? '재발급 요청에 실패했습니다.'); return; }
      await loadAll(id);
      alert('현금영수증 재발급 요청이 완료되었습니다.');
    } catch (err: any) {
      alert(err.message ?? '재발급 요청 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReissueTaxInvoice(invoiceId: string) {
    if (!order || !id) return;
    const newAmount = order.totalAmount - order.returnedAmount;
    if (!confirm(`세금계산서를 ${formatCurrency(newAmount)}으로 재발급 요청하시겠습니까?`)) return;
    setSaving(true);
    try {
      const result = await reissueTaxInvoice(invoiceId, newAmount);
      if (!result.success) { alert(result.error ?? '재발급 요청에 실패했습니다.'); return; }
      await loadAll(id);
      alert('세금계산서 재발급 요청이 완료되었습니다.');
    } catch (err: any) {
      alert(err.message ?? '재발급 요청 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) return <div className="container py-8">로딩 중...</div>;
  if (!order) return <div className="container py-8 text-center text-gray-500">주문을 찾을 수 없습니다.</div>;

  const statusColor = ORDER_STATUS_COLORS[order.status as OrderStatus] ?? 'bg-gray-100 text-gray-700';
  const nextStatuses = ORDER_STATUS_TRANSITIONS[order.status as OrderStatus] ?? [];
  const trackingUrl = shipment?.company?.trackingUrl && shipment.trackingNumber
    ? shipment.company.trackingUrl.replace('{tracking_number}', shipment.trackingNumber)
    : null;

  const ACTION_LABELS: Partial<Record<OrderStatus, { label: string; color: string }>> = {
    paid:             { label: '상품준비 시작', color: 'bg-indigo-600 text-white hover:bg-indigo-700' },
    processing:       { label: '배송중 처리', color: 'bg-purple-600 text-white hover:bg-purple-700' },
    shipped:          { label: '배송완료 처리', color: 'bg-teal-600 text-white hover:bg-teal-700' },
    delivered:        { label: '구매확정 처리', color: 'bg-green-600 text-white hover:bg-green-700' },
    cancelled:        { label: '취소 처리', color: 'bg-red-100 text-red-700 hover:bg-red-200' },
    return_requested: { label: '반품완료 처리', color: 'bg-orange-600 text-white hover:bg-orange-700' },
  };

  const ITEM_TYPE_LABELS: Record<string, string> = {
    purchase: '', gift: '사은품', bundle_component: '구성상품',
  };

  const isPartialCancelable   = ['pending', 'paid', 'processing'].includes(order.status);
  const isReturnExchangeable  = ORDER_RETURNABLE_STATUSES.includes(order.status as OrderStatus);

  function toggleItemSelection(itemId: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  return (
    <>
      {/* 인쇄 스타일 */}
      <style>{`@media print { .no-print { display: none !important; } }`}</style>

      <div className="container py-8 max-w-7xl">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between no-print">
          <Link to="/admin/orders" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="mr-1 h-4 w-4" />주문 목록
          </Link>
          <div className="flex gap-2">
            {['paid', 'shipped', 'delivered', 'confirmed'].includes(order.status) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/admin/orders/${id}/invoice`, '_blank')}
              >
                <FileText className="mr-2 h-4 w-4" />거래명세서
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />인쇄
            </Button>
          </div>
        </div>

        {/* 주문 제목 */}
        <div className="mb-6 flex items-center gap-4 flex-wrap">
          <h1 className="text-2xl font-bold font-mono">{order.orderNumber}</h1>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusColor}`}>
            {ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}
          </span>
          <span className="text-sm text-gray-500">{format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm')}</span>
          {order.isGift && <span className="text-xs bg-pink-100 text-pink-700 rounded-full px-2 py-0.5">선물포장</span>}
          {(order as any).isAdminOrder && <span className="text-xs bg-violet-100 text-violet-700 rounded-full px-2 py-0.5 no-print">관리자 생성</span>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽 2칸 */}
          <div className="lg:col-span-2 space-y-6">

            {/* 주문 상품 */}
            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold text-gray-800">
                  <Package className="h-4 w-4" />주문 상품
                </h2>
                <div className="flex gap-2 no-print">
                  {order.status === 'pending' && (
                    <button
                      onClick={openItemEdit}
                      className="flex items-center gap-1 text-sm rounded-md border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50 transition-colors">
                      <Edit2 className="h-3.5 w-3.5" />상품 수정
                    </button>
                  )}
                  {isPartialCancelable && selectedItemIds.size > 0 && (
                    <button
                      onClick={() => setPartialCancelModal(true)}
                      className="text-sm rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-red-700 hover:bg-red-100 transition-colors">
                      선택 항목 취소 ({selectedItemIds.size}건)
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-3 items-start py-2 border-b last:border-0">
                    {isPartialCancelable && item.itemType !== 'gift' ? (
                      <input
                        type="checkbox"
                        checked={selectedItemIds.has(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                        className="no-print mt-1 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                      />
                    ) : (
                      isPartialCancelable && <div className="no-print w-4 flex-shrink-0" />
                    )}
                    {item.productImage ? (
                      <img src={item.productImage} alt={item.productName}
                        className="h-14 w-14 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-14 w-14 rounded bg-gray-100 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{item.productName}</p>
                        {ITEM_TYPE_LABELS[item.itemType] && (
                          <span className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">
                            {ITEM_TYPE_LABELS[item.itemType]}
                          </span>
                        )}
                        {item.status !== 'pending' && (
                          <span className={`text-xs rounded px-1.5 py-0.5 ${ORDER_ITEM_STATUS_COLORS[item.status as OrderItemStatus] ?? 'bg-gray-100 text-gray-700'}`}>
                            {ORDER_ITEM_STATUS_LABELS[item.status as OrderItemStatus] ?? item.status}
                          </span>
                        )}
                      </div>
                      {item.optionText && <p className="text-xs text-gray-500">{item.optionText}</p>}
                      <p className="text-sm text-gray-600 mt-1">
                        {formatCurrency(item.unitPrice)} × {item.quantity}
                        {item.discountAmount > 0 && <span className="text-red-500 ml-1">(-{formatCurrency(item.discountAmount)})</span>}
                        <span className="ml-2 font-medium">{formatCurrency(item.totalPrice)}</span>
                        {(item.returnedQuantity > 0 || item.exchangedQuantity > 0) && (
                          <span className="ml-2 text-xs text-gray-400">
                            (반품 {item.returnedQuantity} / 교환 {item.exchangedQuantity})
                          </span>
                        )}
                      </p>
                    </div>
                    {isReturnExchangeable && item.itemType !== 'gift' && (item.quantity - item.returnedQuantity - item.exchangedQuantity) > 0 && (
                      <div className="no-print flex gap-1 shrink-0">
                        <button
                          onClick={() => openReturnModal(item)}
                          className="text-xs rounded border border-orange-300 bg-orange-50 px-2 py-1 text-orange-700 hover:bg-orange-100 transition-colors">
                          반품
                        </button>
                        <button
                          onClick={() => openExchangeModal(item)}
                          className="text-xs rounded border border-blue-300 bg-blue-50 px-2 py-1 text-blue-700 hover:bg-blue-100 transition-colors">
                          교환
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {isPartialCancelable && order.items.filter((i) => i.itemType !== 'gift').length > 1 && (
                <p className="no-print mt-3 text-xs text-gray-400">
                  취소할 상품을 선택하면 부분 취소할 수 있습니다. (배송 시작 전에만 가능)
                </p>
              )}
            </Card>

            {/* 주문자 / 배송지 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="p-5">
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-800">
                  <User className="h-4 w-4" />주문자
                </h2>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex gap-2"><dt className="text-gray-500 w-14">이름</dt><dd className="font-medium">{order.ordererName}</dd></div>
                  <div className="flex gap-2"><dt className="text-gray-500 w-14">연락처</dt><dd>{order.ordererPhone}</dd></div>
                  {order.ordererEmail && <div className="flex gap-2"><dt className="text-gray-500 w-14">이메일</dt><dd className="truncate">{order.ordererEmail}</dd></div>}
                </dl>
                {order.userId && (
                  <Link to={`/admin/users/${order.userId}`}
                    className="mt-3 inline-flex items-center text-xs text-blue-600 hover:underline no-print">
                    회원 정보 보기 <ExternalLink className="ml-1 h-3 w-3" />
                  </Link>
                )}
              </Card>

              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-semibold text-gray-800">
                    <MapPin className="h-4 w-4" />배송지
                  </h2>
                  {order.status === 'pending' && (
                    <button
                      onClick={openShippingEdit}
                      className="no-print flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors">
                      <Edit2 className="h-3 w-3" />수정
                    </button>
                  )}
                </div>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex gap-2"><dt className="text-gray-500 w-14">수령인</dt><dd className="font-medium">{order.recipientName}</dd></div>
                  <div className="flex gap-2"><dt className="text-gray-500 w-14">연락처</dt><dd>{order.recipientPhone}</dd></div>
                  <div className="flex gap-2"><dt className="text-gray-500 w-14">주소</dt>
                    <dd>
                      <p>({order.postalCode}) {order.address1}</p>
                      {order.address2 && <p>{order.address2}</p>}
                    </dd>
                  </div>
                  {order.shippingMessage && (
                    <div className="flex gap-2"><dt className="text-gray-500 w-14">요청사항</dt><dd className="text-gray-600">{order.shippingMessage}</dd></div>
                  )}
                </dl>
              </Card>
            </div>

            {/* 결제 정보 */}
            <Card className="p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-800">
                <CreditCard className="h-4 w-4" />결제 정보
              </h2>
              <dl className="space-y-1.5 text-sm">
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-24">결제수단</dt>
                  <dd>
                    {order.paymentMethod === 'card' && '신용카드'}
                    {order.paymentMethod === 'virtual_account' && '가상계좌'}
                    {order.paymentMethod === 'bank_transfer' && '무통장입금'}
                    {order.paymentMethod && !['card', 'virtual_account', 'bank_transfer'].includes(order.paymentMethod) && order.paymentMethod}
                    {order.pgProvider && <span className="text-gray-400 ml-1">({order.pgProvider})</span>}
                  </dd>
                </div>
                {order.paidAt && (
                  <div className="flex gap-2"><dt className="text-gray-500 w-24">결제일시</dt><dd>{format(new Date(order.paidAt), 'yyyy-MM-dd HH:mm')}</dd></div>
                )}
                {order.paymentDeadline && order.status === 'pending' && (
                  <div className="flex gap-2 text-orange-600">
                    <dt className="w-24">입금마감</dt>
                    <dd className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {format(new Date(order.paymentDeadline), 'yyyy-MM-dd HH:mm')}
                    </dd>
                  </div>
                )}
              </dl>

              {/* 가상계좌 */}
              {vbank && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm">
                  <p className="font-medium text-blue-800 mb-2">가상계좌 정보</p>
                  <dl className="space-y-1">
                    <div className="flex gap-2"><dt className="text-blue-600 w-16">은행</dt><dd>{vbank.bankName}</dd></div>
                    <div className="flex gap-2"><dt className="text-blue-600 w-16">계좌번호</dt><dd className="font-mono">{vbank.accountNumber}</dd></div>
                    <div className="flex gap-2"><dt className="text-blue-600 w-16">예금주</dt><dd>{vbank.holderName}</dd></div>
                    <div className="flex gap-2"><dt className="text-blue-600 w-16">입금기한</dt>
                      <dd className={new Date(vbank.expiresAt) < new Date() ? 'text-red-600' : ''}>
                        {format(new Date(vbank.expiresAt), 'yyyy-MM-dd HH:mm')}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              {/* 영수증 링크 */}
              {payments.map((p) => p.receiptUrl && (
                <a key={p.id} href={p.receiptUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center text-xs text-blue-600 hover:underline no-print">
                  결제 영수증 보기 <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              ))}
            </Card>

            {/* 현금영수증 / 세금계산서 */}
            {(cashReceipts.length > 0 || taxInvoices.length > 0) && (
              <Card className="p-5">
                <h2 className="mb-3 font-semibold text-gray-800">세금계산서 / 현금영수증</h2>
                {cashReceipts.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 text-sm py-1.5 border-b last:border-0 flex-wrap">
                    <span className="text-gray-500">현금영수증</span>
                    <span>{c.receiptType === 'income_deduction' ? '소득공제' : '지출증빙'}</span>
                    <span className="text-gray-500">{c.identifier}</span>
                    <span>{formatCurrency(c.amount)}</span>
                    <span className={`text-xs rounded-full px-2 py-0.5 ${c.status === 'issued' ? 'bg-green-100 text-green-700' : c.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {c.status === 'issued' ? '발급됨' : c.status === 'cancelled' ? '취소됨' : '처리중'}
                    </span>
                    {c.status === 'issued' && order.returnedAmount > 0 && (
                      <button
                        onClick={() => handleReissueCashReceipt(c.id)}
                        disabled={saving}
                        className="no-print ml-auto text-xs border border-orange-300 rounded px-2 py-0.5 text-orange-700 hover:bg-orange-50 disabled:opacity-50">
                        재발급 요청
                      </button>
                    )}
                  </div>
                ))}
                {taxInvoices.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 text-sm py-1.5 border-b last:border-0 flex-wrap">
                    <span className="text-gray-500">세금계산서</span>
                    <span>{t.businessName}</span>
                    <span className="text-gray-400 font-mono text-xs">{t.businessNumber}</span>
                    <span>{formatCurrency(t.totalAmount)}</span>
                    <span className={`text-xs rounded-full px-2 py-0.5 ${t.status === 'issued' ? 'bg-green-100 text-green-700' : t.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {t.status === 'issued' ? '발급됨' : t.status === 'cancelled' ? '취소됨' : '신청됨'}
                    </span>
                    {t.status === 'issued' && order.returnedAmount > 0 && (
                      <button
                        onClick={() => handleReissueTaxInvoice(t.id)}
                        disabled={saving}
                        className="no-print ml-auto text-xs border border-orange-300 rounded px-2 py-0.5 text-orange-700 hover:bg-orange-50 disabled:opacity-50">
                        재발급 요청
                      </button>
                    )}
                  </div>
                ))}
              </Card>
            )}

            {/* 반품 / 교환 신청 */}
            {(returns.length > 0 || exchanges.length > 0) && (
              <Card className="p-5">
                <h2 className="mb-3 font-semibold text-gray-800">반품 / 교환 내역</h2>
                {returns.map((r) => (
                  <div key={r.id} className="py-2 border-b last:border-0 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-orange-700">반품</span>
                      {r.initiatedBy === 'admin' && (
                        <span className="text-xs bg-violet-100 text-violet-700 rounded-full px-1.5 py-0.5">관리자</span>
                      )}
                      <span className={`text-xs rounded-full px-2 py-0.5 ${r.status === 'completed' ? 'bg-green-100 text-green-700' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : r.status === 'approved' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {r.status === 'pending' ? '검토중' : r.status === 'approved' ? '승인' : r.status === 'rejected' ? '거부' : r.status === 'completed' ? '완료' : r.status}
                      </span>
                      {r.refundAmount > 0 && (
                        <span className="text-orange-600 font-medium ml-auto">-{formatCurrency(r.refundAmount)}</span>
                      )}
                      <span className="text-gray-400 text-xs">{format(new Date(r.createdAt), 'MM/dd HH:mm')}</span>
                    </div>
                    <p className="mt-0.5 text-gray-500 text-xs">{RETURN_REASONS.find((x) => x.value === r.reason)?.label ?? r.reason}</p>
                  </div>
                ))}
                {exchanges.map((e) => (
                  <div key={e.id} className="py-2 border-b last:border-0 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-blue-700">교환</span>
                      {e.initiatedBy === 'admin' && (
                        <span className="text-xs bg-violet-100 text-violet-700 rounded-full px-1.5 py-0.5">관리자</span>
                      )}
                      <span className={`text-xs rounded-full px-2 py-0.5 ${e.status === 'completed' ? 'bg-green-100 text-green-700' : e.status === 'rejected' ? 'bg-red-100 text-red-700' : e.status === 'approved' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {e.status === 'pending' ? '검토중' : e.status === 'approved' ? '승인' : e.status === 'rejected' ? '거부' : e.status === 'completed' ? '완료' : e.status}
                      </span>
                      {e.priceDiff !== 0 && (
                        <span className={`font-medium ml-auto text-xs ${e.priceDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {e.priceDiff > 0 ? `+${formatCurrency(e.priceDiff)}` : formatCurrency(e.priceDiff)}
                        </span>
                      )}
                      <span className="text-gray-400 text-xs">{format(new Date(e.createdAt), 'MM/dd HH:mm')}</span>
                    </div>
                    <p className="mt-0.5 text-gray-500 text-xs">{EXCHANGE_REASONS.find((x) => x.value === e.reason)?.label ?? e.reason}</p>
                  </div>
                ))}
              </Card>
            )}

            {/* 상태 타임라인 */}
            <Card className="p-5">
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-800">
                <Clock className="h-4 w-4" />상태 타임라인
              </h2>
              {timeline.length === 0 ? (
                <p className="text-sm text-gray-400">이력이 없습니다.</p>
              ) : (
                <ol className="relative border-l border-gray-200 space-y-4 ml-3">
                  {timeline.map((t) => (
                    <li key={t.id} className="ml-4">
                      <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-500" />
                      <div className="flex items-center gap-2 flex-wrap">
                        {t.fromStatus && (
                          <>
                            <span className="text-xs text-gray-400">{ORDER_STATUS_LABELS[t.fromStatus as OrderStatus] ?? t.fromStatus}</span>
                            <span className="text-xs text-gray-400">→</span>
                          </>
                        )}
                        <span className="text-sm font-medium">{ORDER_STATUS_LABELS[t.toStatus as OrderStatus] ?? t.toStatus}</span>
                        <span className="text-xs text-gray-400 ml-auto">{format(new Date(t.createdAt), 'yyyy-MM-dd HH:mm')}</span>
                      </div>
                      {t.note && <p className="mt-0.5 text-xs text-gray-500">{t.note}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>

          {/* 오른쪽 1칸 — 액션 */}
          <div className="space-y-5 no-print">

            {/* 상태 관리 */}
            <Card className="p-5">
              <h2 className="mb-3 font-semibold text-gray-800">주문 상태 관리</h2>
              <div className="mb-3">
                <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium ${statusColor}`}>
                  현재: {ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}
                </span>
              </div>
              {nextStatuses.length > 0 ? (
                <div className="space-y-2">
                  {nextStatuses.map((s) => {
                    const cfg = ACTION_LABELS[s];
                    if (!cfg) return null;
                    return (
                      <button key={s} disabled={saving}
                        onClick={() => handleTransition(s)}
                        className={`w-full rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${cfg.color}`}>
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400">처리 완료된 주문입니다.</p>
              )}
              {order.autoConfirmAt && (
                <p className="mt-2 text-xs text-gray-400">
                  자동 구매확정: {format(new Date(order.autoConfirmAt), 'yyyy-MM-dd')}
                </p>
              )}
            </Card>

            {/* 송장 정보 */}
            <Card className={`p-5 transition-all ${shipmentHighlight ? 'ring-2 ring-red-400' : ''}`} ref={shipmentRef as any}>
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-800">
                <Truck className="h-4 w-4" />송장 정보
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">배송사</label>
                  <Select value={shippingCompanyId} onValueChange={setShippingCompanyId}>
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
                  <label className="text-xs font-medium text-gray-600">운송장 번호</label>
                  <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="운송장 번호 입력" className="mt-1" />
                </div>
                <Button className="w-full" onClick={handleSaveShipment} disabled={saving}>
                  {saving ? '저장 중...' : '운송장 저장'}
                </Button>
              </div>
              {trackingUrl && (
                <a href={trackingUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center text-sm text-blue-600 hover:underline">
                  <Truck className="mr-1 h-3.5 w-3.5" />배송 조회 <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              )}
              {shipment?.shippedAt && (
                <p className="mt-1 text-xs text-gray-400">발송: {format(new Date(shipment.shippedAt), 'yyyy-MM-dd HH:mm')}</p>
              )}
            </Card>

            {/* 금액 내역 */}
            <Card className="p-5">
              <h2 className="mb-3 font-semibold text-gray-800">금액 내역</h2>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">상품 소계</dt><dd>{formatCurrency(order.subtotal)}</dd></div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-red-600"><dt>상품 할인</dt><dd>-{formatCurrency(order.discountAmount)}</dd></div>
                )}
                {order.couponDiscount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <dt>쿠폰 할인{order.coupon ? ` (${order.coupon.name})` : ''}</dt>
                    <dd>-{formatCurrency(order.couponDiscount)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-gray-500">배송비</dt>
                  <dd>{order.shippingFee > 0 ? `+${formatCurrency(order.shippingFee)}` : '무료'}</dd>
                </div>
                {order.usedPoints > 0 && (
                  <div className="flex justify-between text-red-600"><dt>포인트 사용</dt><dd>-{formatCurrency(order.usedPoints)}</dd></div>
                )}
                {order.usedDeposit > 0 && (
                  <div className="flex justify-between text-red-600"><dt>예치금 사용</dt><dd>-{formatCurrency(order.usedDeposit)}</dd></div>
                )}
                <div className="flex justify-between border-t pt-2 font-bold">
                  <dt>최종 결제금액</dt><dd>{formatCurrency(order.totalAmount)}</dd>
                </div>
                {order.returnedAmount > 0 && (
                  <>
                    <div className="flex justify-between text-orange-600 text-sm">
                      <dt>반품 환불액</dt><dd>-{formatCurrency(order.returnedAmount)}</dd>
                    </div>
                    <div className="flex justify-between border-t pt-2 font-bold text-blue-700">
                      <dt>실결제금액</dt><dd>{formatCurrency(order.totalAmount - order.returnedAmount)}</dd>
                    </div>
                  </>
                )}
                {order.earnedPoints > 0 && (
                  <div className="flex justify-between text-green-600 text-xs">
                    <dt>적립 예정 포인트</dt><dd>{order.earnedPoints.toLocaleString()}P</dd>
                  </div>
                )}
              </dl>
            </Card>

            {/* 관리자 메모 */}
            <Card className="p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-800">
                <MessageSquare className="h-4 w-4" />관리자 메모
              </h2>
              <div className="flex gap-2">
                <Input value={memoInput} onChange={(e) => setMemoInput(e.target.value)}
                  placeholder="메모 입력" onKeyDown={(e) => e.key === 'Enter' && handleAddMemo()} />
                <Button onClick={handleAddMemo} disabled={!memoInput.trim()}>등록</Button>
              </div>
              {memos.length > 0 && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {memos.map((m) => (
                    <div key={m.id} className="rounded bg-gray-50 p-2.5 text-sm">
                      <p className="text-gray-800">{m.content}</p>
                      <p className="mt-1 text-xs text-gray-400">{format(new Date(m.createdAt), 'MM/dd HH:mm')}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* 부분 취소 모달 */}
      {partialCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">선택 상품 부분 취소</h2>
              <button onClick={() => setPartialCancelModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div className="rounded-md bg-gray-50 p-3 text-sm space-y-1">
                {order.items
                  .filter((item) => selectedItemIds.has(item.id))
                  .map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span className="text-gray-700 truncate flex-1 mr-2">{item.productName}{item.optionText ? ` (${item.optionText})` : ''}</span>
                      <span className="font-medium flex-shrink-0">{formatCurrency(item.totalPrice)}</span>
                    </div>
                  ))}
                <div className="border-t pt-1 flex justify-between font-semibold">
                  <span>합계</span>
                  <span>{formatCurrency(order.items.filter((i) => selectedItemIds.has(i.id)).reduce((s, i) => s + i.totalPrice, 0))}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">취소 사유 <span className="text-red-500">*</span></label>
                <textarea value={partialCancelReason} onChange={(e) => setPartialCancelReason(e.target.value)}
                  placeholder="취소 사유를 입력해주세요."
                  className="mt-1 w-full rounded-md border border-gray-300 p-2.5 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <p className="text-xs text-amber-600">포인트·쿠폰·예치금은 전체 취소 시에만 복구됩니다.</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPartialCancelModal(false)}>닫기</Button>
              <Button onClick={handlePartialCancel} disabled={!partialCancelReason.trim() || saving}
                className="bg-red-600 hover:bg-red-700 text-white">
                <Check className="mr-2 h-4 w-4" />부분 취소 확정
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 배송지 수정 모달 */}
      {shippingEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">배송지 수정</h2>
              <button onClick={() => setShippingEditModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">입금 전(pending) 주문에만 수정이 가능합니다.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">주문자명</label>
                  <Input value={shippingEdit.ordererName} onChange={(e) => setShippingEdit((p) => ({ ...p, ordererName: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">주문자 연락처</label>
                  <Input value={shippingEdit.ordererPhone} onChange={(e) => setShippingEdit((p) => ({ ...p, ordererPhone: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">수령인 <span className="text-red-500">*</span></label>
                  <Input value={shippingEdit.recipientName} onChange={(e) => setShippingEdit((p) => ({ ...p, recipientName: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">수령인 연락처 <span className="text-red-500">*</span></label>
                  <Input value={shippingEdit.recipientPhone} onChange={(e) => setShippingEdit((p) => ({ ...p, recipientPhone: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">우편번호 <span className="text-red-500">*</span></label>
                <Input value={shippingEdit.postalCode} onChange={(e) => setShippingEdit((p) => ({ ...p, postalCode: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">주소 <span className="text-red-500">*</span></label>
                <Input value={shippingEdit.address1} onChange={(e) => setShippingEdit((p) => ({ ...p, address1: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">상세주소</label>
                <Input value={shippingEdit.address2} onChange={(e) => setShippingEdit((p) => ({ ...p, address2: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">배송 메시지</label>
                <Input value={shippingEdit.shippingMessage} onChange={(e) => setShippingEdit((p) => ({ ...p, shippingMessage: e.target.value }))} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShippingEditModal(false)}>닫기</Button>
              <Button onClick={handleSaveShippingEdit} disabled={saving || !shippingEdit.recipientName || !shippingEdit.address1}>
                <Check className="mr-2 h-4 w-4" />{saving ? '저장 중...' : '저장'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 상품 수정 모달 */}
      {itemEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">상품 수정</h2>
              <button onClick={() => setItemEditModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>

            {/* 현재 상품 목록 */}
            <div className="space-y-2 mb-4">
              {editItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.productName}</p>
                    {item.optionText && <p className="text-xs text-gray-500">{item.optionText}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-500">{item.unitPrice.toLocaleString()}원</span>
                      {item.itemType === 'gift' && <span className="text-xs bg-blue-100 text-blue-700 rounded px-1">사은품</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditItems((prev) => prev.map((i, j) => j === idx ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))}
                      className="h-7 w-7 flex items-center justify-center rounded border text-gray-600 hover:bg-gray-100">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <button
                      onClick={() => setEditItems((prev) => prev.map((i, j) => j === idx ? { ...i, quantity: i.quantity + 1 } : i))}
                      className="h-7 w-7 flex items-center justify-center rounded border text-gray-600 hover:bg-gray-100">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="shrink-0 font-medium w-20 text-right">{(item.unitPrice * item.quantity).toLocaleString()}원</div>
                  <button
                    onClick={() => setEditItems((prev) => prev.filter((_, j) => j !== idx))}
                    className="shrink-0 text-red-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {editItems.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">상품을 추가해주세요.</p>
              )}
            </div>

            {/* 소계 미리보기 */}
            {editItems.length > 0 && (
              <div className="text-right text-sm text-gray-600 mb-4">
                소계 <span className="font-semibold text-gray-900">
                  {editItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toLocaleString()}원
                </span>
                <span className="text-xs text-gray-400 ml-2">(배송비·할인은 저장 후 자동 반영)</span>
              </div>
            )}

            {/* 상품 검색 */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">상품 추가</p>
              <div className="flex gap-2">
                <Input
                  value={productSearchQ}
                  onChange={(e) => setProductSearchQ(e.target.value)}
                  placeholder="상품명 검색..."
                  onKeyDown={(e) => e.key === 'Enter' && handleProductSearch()}
                />
                <Button variant="outline" onClick={handleProductSearch} size="sm">
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {productSearchResults.length > 0 && !selectedProductForAdd && (
                <div className="mt-2 border rounded-lg divide-y max-h-48 overflow-y-auto">
                  {productSearchResults.map((p) => (
                    <button key={p.id} onClick={() => handleSelectProduct(p)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-gray-500">{p.price.toLocaleString()}원</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedProductForAdd && variantResults.length > 0 && (
                <div className="mt-2 border rounded-lg divide-y max-h-48 overflow-y-auto">
                  <p className="px-3 py-2 text-xs text-gray-500 bg-gray-50">옵션 선택 — {selectedProductForAdd.name}</p>
                  {variantResults.map((v) => (
                    <button key={v.id} onClick={() => handleSelectVariant(v)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left">
                      <span>{v.optionText}</span>
                      <span className="text-gray-500">{(v.price || selectedProductForAdd.price + v.additionalPrice).toLocaleString()}원</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setItemEditModal(false)}>닫기</Button>
              <Button onClick={handleSaveItemEdit} disabled={saving || editItems.length === 0}>
                <Check className="mr-2 h-4 w-4" />{saving ? '저장 중...' : '수정 저장'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 반품 모달 */}
      {returnModalOpen && returnTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">반품 처리</h2>
              <button onClick={() => setReturnModalOpen(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="rounded-md bg-gray-50 p-3">
                <p className="font-medium">{returnTargetItem.productName}</p>
                {returnTargetItem.optionText && <p className="text-gray-500 text-xs">{returnTargetItem.optionText}</p>}
                <p className="text-gray-500 text-xs mt-0.5">{formatCurrency(returnTargetItem.unitPrice)} × {returnTargetItem.quantity}개 (반품가능: {returnTargetItem.quantity - returnTargetItem.returnedQuantity - returnTargetItem.exchangedQuantity}개)</p>
              </div>
              <div>
                <label className="font-medium">반품 수량</label>
                <div className="flex items-center gap-2 mt-1">
                  <button onClick={() => handleReturnQtyChange(returnQty - 1)}
                    className="h-8 w-8 flex items-center justify-center rounded border text-gray-600 hover:bg-gray-100"><Minus className="h-3 w-3" /></button>
                  <span className="w-10 text-center font-medium">{returnQty}</span>
                  <button onClick={() => handleReturnQtyChange(returnQty + 1)}
                    className="h-8 w-8 flex items-center justify-center rounded border text-gray-600 hover:bg-gray-100"><Plus className="h-3 w-3" /></button>
                  <span className="text-gray-500 ml-2">예상 환불: <span className="font-semibold text-orange-600">{formatCurrency(returnRefundPreview)}</span></span>
                </div>
              </div>
              <div>
                <label className="font-medium">반품 사유 <span className="text-red-500">*</span></label>
                <div className="mt-1 space-y-1">
                  {RETURN_REASONS.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="returnReason" value={r.value}
                        checked={returnReason === r.value} onChange={(e) => setReturnReason(e.target.value)}
                        className="h-3.5 w-3.5" />
                      <span>{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="font-medium">상세 메모 (선택)</label>
                <textarea value={returnDescription} onChange={(e) => setReturnDescription(e.target.value)}
                  placeholder="추가 메모를 입력하세요."
                  className="mt-1 w-full rounded-md border border-gray-300 p-2.5 text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">관리자 반품은 즉시 completed 상태로 처리되며 재고가 복구됩니다.</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReturnModalOpen(false)}>닫기</Button>
              <Button onClick={handleSubmitReturn} disabled={!returnReason || saving}
                className="bg-orange-600 hover:bg-orange-700 text-white">
                <Check className="mr-2 h-4 w-4" />{saving ? '처리 중...' : '반품 처리'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 교환 모달 */}
      {exchangeModalOpen && exchangeTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">교환 처리 {exchangeStep === 2 && '— 교환 상품 선택'}</h2>
              <button onClick={() => setExchangeModalOpen(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>

            {exchangeStep === 1 && (
              <div className="space-y-4 text-sm">
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="font-medium">{exchangeTargetItem.productName}</p>
                  {exchangeTargetItem.optionText && <p className="text-gray-500 text-xs">{exchangeTargetItem.optionText}</p>}
                  <p className="text-gray-500 text-xs mt-0.5">{formatCurrency(exchangeTargetItem.unitPrice)} × {exchangeTargetItem.quantity}개 (교환가능: {exchangeTargetItem.quantity - exchangeTargetItem.returnedQuantity - exchangeTargetItem.exchangedQuantity}개)</p>
                </div>
                <div>
                  <label className="font-medium">교환 수량</label>
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => setExchangeQty((q) => Math.max(1, q - 1))}
                      className="h-8 w-8 flex items-center justify-center rounded border text-gray-600 hover:bg-gray-100"><Minus className="h-3 w-3" /></button>
                    <span className="w-10 text-center font-medium">{exchangeQty}</span>
                    <button onClick={() => {
                      const max = exchangeTargetItem.quantity - exchangeTargetItem.returnedQuantity - exchangeTargetItem.exchangedQuantity;
                      setExchangeQty((q) => Math.min(q + 1, max));
                    }} className="h-8 w-8 flex items-center justify-center rounded border text-gray-600 hover:bg-gray-100"><Plus className="h-3 w-3" /></button>
                  </div>
                </div>
                <div>
                  <label className="font-medium">교환 사유 <span className="text-red-500">*</span></label>
                  <div className="mt-1 space-y-1">
                    {EXCHANGE_REASONS.map((r) => (
                      <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="exchangeReason" value={r.value}
                          checked={exchangeReason === r.value} onChange={(e) => setExchangeReason(e.target.value)}
                          className="h-3.5 w-3.5" />
                        <span>{r.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setExchangeModalOpen(false)}>닫기</Button>
                  <Button onClick={() => setExchangeStep(2)} disabled={!exchangeReason}>
                    다음 — 교환 상품 선택
                  </Button>
                </div>
              </div>
            )}

            {exchangeStep === 2 && (
              <div className="space-y-4 text-sm">
                <div>
                  <label className="font-medium">교환 상품 검색</label>
                  <div className="flex gap-2 mt-1">
                    <Input value={exchangeSearchQ} onChange={(e) => setExchangeSearchQ(e.target.value)}
                      placeholder="상품명 검색..."
                      onKeyDown={(e) => e.key === 'Enter' && handleExchangeProductSearch()} />
                    <Button variant="outline" onClick={handleExchangeProductSearch} size="sm">
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  {exchangeSearchResults.length > 0 && !exchangeSelectedProduct && (
                    <div className="mt-2 border rounded-lg divide-y max-h-40 overflow-y-auto">
                      {exchangeSearchResults.map((p) => (
                        <button key={p.id} onClick={() => handleExchangeSelectProduct(p)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-gray-500">{formatCurrency(p.price)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {exchangeSelectedProduct && (
                  <div className="rounded-md bg-blue-50 p-3">
                    <p className="font-medium text-blue-800">{exchangeSelectedProduct.name}</p>
                    {exchangeVariantResults.length === 0 ? (
                      <p className="text-xs text-red-500 mt-1">이 상품은 선택 가능한 옵션이 없습니다.</p>
                    ) : !exchangeSelectedVariant ? (
                      <div className="mt-2 border rounded-lg divide-y bg-white max-h-36 overflow-y-auto">
                        {exchangeVariantResults.map((v) => (
                          <button key={v.id} onClick={() => handleExchangeSelectVariant(v)}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left text-sm">
                            <span>{v.optionText}</span>
                            <span className="text-gray-500">{formatCurrency(v.price)}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 space-y-1 text-xs">
                        <p>선택된 옵션: <span className="font-medium">{exchangeSelectedVariant.optionText}</span></p>
                        <p>교환 상품가: <span className="font-medium">{formatCurrency(exchangeSelectedVariant.price)}</span></p>
                        <p>가격 차이: <span className={`font-semibold ${exchangePriceDiff > 0 ? 'text-red-600' : exchangePriceDiff < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                          {exchangePriceDiff > 0 ? `+${formatCurrency(exchangePriceDiff)}` : exchangePriceDiff < 0 ? formatCurrency(exchangePriceDiff) : '없음'}
                        </span></p>
                        <button onClick={() => { setExchangeSelectedVariant(null); setExchangeSelectedProduct(null); setExchangeSearchResults([]); }}
                          className="text-blue-600 hover:underline">다시 선택</button>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">관리자 교환은 즉시 completed 상태로 처리됩니다. 재고가 자동 조정됩니다.</p>
                <div className="flex justify-between gap-2 pt-2">
                  <Button variant="outline" onClick={() => setExchangeStep(1)}>이전</Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setExchangeModalOpen(false)}>닫기</Button>
                    <Button onClick={handleSubmitExchange}
                      disabled={!exchangeSelectedVariant || !exchangeSelectedVariant.id || saving}
                      className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Check className="mr-2 h-4 w-4" />{saving ? '처리 중...' : '교환 처리'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 취소 모달 */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">주문 취소</h2>
              <button onClick={() => setCancelModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-gray-600 font-mono bg-gray-50 p-3 rounded">{order.orderNumber}</p>
              <div>
                <label className="text-sm font-medium">취소 사유 <span className="text-red-500">*</span></label>
                <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="취소 사유를 입력해주세요."
                  className="mt-1 w-full rounded-md border border-gray-300 p-2.5 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <p className="text-xs text-red-600">취소 후에는 되돌릴 수 없습니다.</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCancelModal(false)}>닫기</Button>
              <Button onClick={handleCancelConfirm} disabled={!cancelReason.trim() || saving}
                className="bg-red-600 hover:bg-red-700 text-white">
                <Check className="mr-2 h-4 w-4" />취소 확정
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
