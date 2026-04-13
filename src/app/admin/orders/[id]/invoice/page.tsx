import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createClient } from '@/lib/supabase/client';
import { getSiteInfo } from '@/services/settings';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface InvoiceOrder {
  id: string;
  orderNumber: string;
  ordererName: string;
  ordererPhone: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;
  address2: string | null;
  shippingMessage: string | null;
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  couponDiscount: number;
  usedPoints: number;
  totalAmount: number;
  paymentMethod: string | null;
  status: string;
  createdAt: string;
  paidAt: string | null;
  adminMemo: string | null;
  items: Array<{
    id: string;
    productName: string;
    optionText: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    status: string;
    itemType: string;
  }>;
}

const PAYMENT_LABELS: Record<string, string> = {
  bank_transfer: '무통장입금',
  virtual_account: '가상계좌',
  card: '신용카드',
  cash: '현금',
  other: '기타',
};

export default function AdminOrderInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin } = useAuth();

  const [order, setOrder] = useState<InvoiceOrder | null>(null);
  const [siteInfo, setSiteInfo] = useState<Awaited<ReturnType<typeof getSiteInfo>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUnitPrice, setShowUnitPrice] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user || !isAdmin) {
        navigate('/auth/login');
        return;
      }
      loadData();
    }
  }, [user, authLoading, isAdmin]);

  async function loadData() {
    if (!id) return;
    try {
      const supabase = createClient();
      const [
        { data: orderData, error: orderError },
        { data: itemsData },
        info,
      ] = await Promise.all([
        supabase.from('orders').select('*').eq('id', id).single(),
        supabase.from('order_items').select('*').eq('order_id', id).order('created_at', { ascending: true }),
        getSiteInfo(),
      ]);

      if (orderError) throw orderError;
      if (!orderData) throw new Error('주문을 찾을 수 없습니다.');

      setOrder({
        id: orderData.id,
        orderNumber: orderData.order_number,
        ordererName: orderData.orderer_name,
        ordererPhone: orderData.orderer_phone,
        recipientName: orderData.recipient_name,
        recipientPhone: orderData.recipient_phone,
        postalCode: orderData.postal_code,
        address1: orderData.address1,
        address2: orderData.address2,
        shippingMessage: orderData.shipping_message,
        subtotal: orderData.subtotal,
        shippingFee: orderData.shipping_fee,
        discountAmount: orderData.discount_amount ?? 0,
        couponDiscount: orderData.coupon_discount ?? 0,
        usedPoints: orderData.used_points ?? 0,
        totalAmount: orderData.total_amount,
        paymentMethod: orderData.payment_method,
        status: orderData.status,
        createdAt: orderData.created_at,
        paidAt: orderData.paid_at,
        adminMemo: orderData.admin_memo,
        items: (itemsData ?? []).map((item: any) => ({
          id: item.id,
          productName: item.product_name,
          optionText: item.option_text ?? null,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.total_price,
          status: item.status ?? 'pending',
          itemType: item.item_type ?? 'purchase',
        })),
      });
      setSiteInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', fontSize: '14px', color: '#555' }}>
        불러오는 중...
      </div>
    );
  }

  if (error || !order || !siteInfo) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', fontSize: '14px', color: '#dc2626' }}>
        {error || '주문 데이터를 불러올 수 없습니다.'}
      </div>
    );
  }

  const activeItems = order.items.filter((item) => item.status !== 'cancelled' && item.itemType !== 'gift');
  const totalDiscount = order.discountAmount + order.couponDiscount + order.usedPoints;
  const today = format(new Date(), 'yyyy년 MM월 dd일');
  const EMPTY_ROWS = Math.max(0, 8 - activeItems.length);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #e8e8e8; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff; }
          @page { size: A4 portrait; margin: 10mm 15mm; }
          .invoice-paper {
            box-shadow: none !important;
            padding: 0 !important;
            width: 100% !important;
          }
          .invoice-wrap {
            background: #fff !important;
            padding: 0 !important;
            min-height: unset !important;
          }
        }
      `}</style>

      {/* 상단 툴바 (화면 전용) */}
      <div
        className="no-print"
        style={{
          background: '#1c1c1c',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={() => window.print()}
          style={{
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '7px 18px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          🖨 인쇄 / PDF 저장
        </button>
        <button
          onClick={() => window.close()}
          style={{
            background: 'transparent',
            color: '#aaa',
            border: '1px solid #444',
            borderRadius: '6px',
            padding: '7px 14px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          닫기
        </button>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: '#ccc',
            cursor: 'pointer',
            userSelect: 'none',
            marginLeft: '8px',
          }}
        >
          <input
            type="checkbox"
            checked={showUnitPrice}
            onChange={(e) => setShowUnitPrice(e.target.checked)}
            style={{ width: '14px', height: '14px', cursor: 'pointer' }}
          />
          단가 표시
        </label>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#777' }}>
          주문번호: {order.orderNumber}
        </span>
      </div>

      {/* 용지 래퍼 */}
      <div
        className="invoice-wrap"
        style={{
          background: '#e8e8e8',
          padding: '32px 24px 48px',
          minHeight: 'calc(100vh - 46px)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {/* A4 용지 */}
        <div
          className="invoice-paper"
          style={{
            background: '#fff',
            width: '794px',
            padding: '48px 52px',
            boxShadow: '0 4px 16px rgba(0,0,0,.18)',
            fontFamily: "'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', Arial, sans-serif",
            fontSize: '13px',
            color: '#111',
            lineHeight: '1.5',
          }}
        >
          {/* 제목 */}
          <h1
            style={{
              textAlign: 'center',
              fontSize: '22px',
              fontWeight: '700',
              letterSpacing: '14px',
              margin: '0 0 2px',
              paddingLeft: '14px',
            }}
          >
            거 래 명 세 서
          </h1>
          <p style={{ textAlign: 'center', fontSize: '11px', color: '#888', margin: '0 0 20px' }}>
            (공급받는자 보관용)
          </p>

          {/* 주문번호 / 발행일 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '12px', color: '#555' }}>
            <span>
              주문번호:{' '}
              <strong style={{ color: '#111', fontFamily: 'monospace', fontSize: '13px' }}>
                {order.orderNumber}
              </strong>
            </span>
            <span>
              발행일: <strong style={{ color: '#111' }}>{today}</strong>
            </span>
          </div>

          {/* 공급자 / 공급받는자 */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #222', marginBottom: '12px' }}>
            <thead>
              <tr>
                <th style={theadTh({ borderRight: '1.5px solid #222' })}>공급자 (판매자)</th>
                <th style={theadTh({})}>공급받는자 (구매자)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {/* 공급자 */}
                <td style={{ padding: '12px 14px', verticalAlign: 'top', borderRight: '1.5px solid #222' }}>
                  <InfoRow label="사업자번호" value={siteInfo.companyBusinessNumber || '-'} />
                  <InfoRow label="상 호" value={siteInfo.companyName || siteInfo.siteName || '-'} />
                  <InfoRow label="대 표 자" value={siteInfo.companyCeo || '-'} />
                  <InfoRow label="주 소" value={siteInfo.companyAddress || '-'} />
                  <InfoRow label="전 화" value={siteInfo.companyPhone || '-'} />
                  <InfoRow label="이메일" value={siteInfo.companyEmail || '-'} />
                </td>
                {/* 공급받는자 */}
                <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                  <InfoRow label="성 명" value={order.recipientName} />
                  <InfoRow label="연락처" value={order.recipientPhone} />
                  <InfoRow
                    label="주 소"
                    value={`(${order.postalCode}) ${order.address1}${order.address2 ? ' ' + order.address2 : ''}`}
                  />
                  <InfoRow
                    label="결제수단"
                    value={PAYMENT_LABELS[order.paymentMethod || ''] || order.paymentMethod || '-'}
                  />
                  {order.paidAt && (
                    <InfoRow
                      label="결제일시"
                      value={format(new Date(order.paidAt), 'yyyy-MM-dd HH:mm')}
                    />
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 품목 테이블 */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #222' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={itemTh({ width: '36px', textAlign: 'center' })}>No.</th>
                <th style={itemTh({})}>품목명 / 옵션</th>
                <th style={itemTh({ width: '52px', textAlign: 'center' })}>수량</th>
                {showUnitPrice && (
                  <th style={itemTh({ width: '96px', textAlign: 'right' })}>단 가 (원)</th>
                )}
                <th style={itemTh({ width: '106px', textAlign: 'right', borderRight: 'none' })}>금 액 (원)</th>
              </tr>
            </thead>
            <tbody>
              {activeItems.map((item, idx) => (
                <tr key={item.id} style={{ borderTop: '1px solid #ddd' }}>
                  <td style={itemTd({ textAlign: 'center', color: '#777' })}>{idx + 1}</td>
                  <td style={itemTd({ lineHeight: '1.4' })}>
                    <div style={{ fontWeight: '600', fontSize: '12px', color: '#111' }}>
                      {item.productName}
                    </div>
                    {item.optionText && (
                      <div style={{ fontSize: '11px', color: '#777', marginTop: '2px' }}>
                        {item.optionText}
                      </div>
                    )}
                  </td>
                  <td style={itemTd({ textAlign: 'center', fontWeight: '600' })}>
                    {item.quantity.toLocaleString()}
                  </td>
                  {showUnitPrice && (
                    <td style={itemTd({ textAlign: 'right' })}>
                      {item.unitPrice.toLocaleString()}
                    </td>
                  )}
                  <td style={itemTd({ textAlign: 'right', borderRight: 'none', fontWeight: '700' })}>
                    {item.totalPrice.toLocaleString()}
                  </td>
                </tr>
              ))}
              {/* 빈 행 */}
              {Array.from({ length: EMPTY_ROWS }).map((_, i) => (
                <tr key={`empty-${i}`} style={{ borderTop: '1px solid #ddd' }}>
                  <td style={itemTd({ height: '28px' })}></td>
                  <td style={itemTd({ height: '28px' })}></td>
                  <td style={itemTd({ height: '28px' })}></td>
                  {showUnitPrice && <td style={itemTd({ height: '28px' })}></td>}
                  <td style={itemTd({ borderRight: 'none', height: '28px' })}></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 금액 합계 */}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1.5px solid #222',
              borderTop: 'none',
              marginBottom: '12px',
            }}
          >
            <tbody>
              <tr style={{ borderTop: '1.5px solid #222' }}>
                <td style={sumLabelTd()}>상품금액 소계</td>
                <td style={sumValueTd()}>{order.subtotal.toLocaleString()} 원</td>
              </tr>
              <tr style={{ borderTop: '1px solid #eee' }}>
                <td style={sumLabelTd()}>배 송 비</td>
                <td style={sumValueTd()}>
                  {order.shippingFee === 0 ? '무료' : `+ ${order.shippingFee.toLocaleString()} 원`}
                </td>
              </tr>
              {totalDiscount > 0 && (
                <tr style={{ borderTop: '1px solid #eee' }}>
                  <td style={sumLabelTd()}>
                    할 인 액
                    <span style={{ fontSize: '11px', color: '#888', marginLeft: '6px' }}>
                      {[
                        order.couponDiscount > 0 ? '쿠폰' : '',
                        order.usedPoints > 0 ? '포인트' : '',
                        order.discountAmount > 0 ? '관리자할인' : '',
                      ]
                        .filter(Boolean)
                        .join(' + ')}
                    </span>
                  </td>
                  <td style={{ ...sumValueTd(), color: '#dc2626' }}>- {totalDiscount.toLocaleString()} 원</td>
                </tr>
              )}
              <tr style={{ borderTop: '1.5px solid #222', background: '#f5f5f5' }}>
                <td
                  style={{
                    ...sumLabelTd(),
                    fontSize: '14px',
                    fontWeight: '700',
                    letterSpacing: '3px',
                    paddingLeft: '14px',
                  }}
                >
                  합 계 금 액
                </td>
                <td
                  style={{
                    ...sumValueTd(),
                    fontSize: '17px',
                    fontWeight: '700',
                    paddingRight: '14px',
                  }}
                >
                  ₩ {order.totalAmount.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 비고 */}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1.5px solid #222',
              marginBottom: '28px',
            }}
          >
            <tbody>
              <tr>
                <td
                  style={{
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: '700',
                    width: '56px',
                    borderRight: '1px solid #ccc',
                    background: '#f5f5f5',
                    textAlign: 'center',
                    verticalAlign: 'top',
                    letterSpacing: '2px',
                  }}
                >
                  비고
                </td>
                <td
                  style={{
                    padding: '8px 12px',
                    fontSize: '12px',
                    color: '#444',
                    verticalAlign: 'top',
                    minHeight: '40px',
                  }}
                >
                  {[order.adminMemo, order.shippingMessage].filter(Boolean).join(' / ') || '\u00A0'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 푸터: 위 금액을 정히 영수합니다 + 서명란 */}
          <p style={{ textAlign: 'center', fontSize: '13px', color: '#333', marginBottom: '20px' }}>
            위 금액을 정히 영수(청구)합니다.
          </p>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
            {/* 공급자 */}
            <div
              style={{
                border: '1px solid #ccc',
                borderRadius: '6px',
                padding: '16px 24px',
                textAlign: 'center',
                minWidth: '200px',
              }}
            >
              <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#888' }}>공급자</p>
              <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: '600' }}>
                {siteInfo.companyName || siteInfo.siteName}
              </p>
              {siteInfo.companyCeo && (
                <p style={{ margin: 0, fontSize: '11px', color: '#777' }}>
                  대표자: {siteInfo.companyCeo} (인)
                </p>
              )}
            </div>
            {/* 인수자 서명 */}
            <div
              style={{
                border: '1px solid #ccc',
                borderRadius: '6px',
                padding: '16px 24px',
                textAlign: 'center',
                minWidth: '200px',
              }}
            >
              <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#888' }}>인수자 서명</p>
              <div
                style={{
                  borderBottom: '1px solid #aaa',
                  width: '140px',
                  margin: '0 auto 6px',
                }}
              />
              <p style={{ margin: 0, fontSize: '11px', color: '#bbb' }}>(서명 또는 인)</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── 헬퍼 컴포넌트 ── */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '3px', fontSize: '12px' }}>
      <span style={{ color: '#777', flexShrink: 0, width: '64px' }}>{label}</span>
      <span style={{ color: '#111', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

/* ── 스타일 헬퍼 ── */

function theadTh(extra: React.CSSProperties): React.CSSProperties {
  return {
    padding: '7px 14px',
    fontSize: '12px',
    fontWeight: '700',
    textAlign: 'center',
    background: '#f0f0f0',
    borderBottom: '1.5px solid #222',
    ...extra,
  };
}

function itemTh(extra: React.CSSProperties): React.CSSProperties {
  return {
    padding: '7px 10px',
    fontSize: '12px',
    fontWeight: '700',
    textAlign: 'left',
    borderRight: '1px solid #ccc',
    borderBottom: '1.5px solid #222',
    ...extra,
  };
}

function itemTd(extra: React.CSSProperties): React.CSSProperties {
  return {
    padding: '6px 10px',
    borderRight: '1px solid #ddd',
    fontSize: '12px',
    verticalAlign: 'middle',
    ...extra,
  };
}

function sumLabelTd(): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRight: '1px solid #ddd',
    fontSize: '12px',
    color: '#555',
    width: '70%',
  };
}

function sumValueTd(): React.CSSProperties {
  return {
    padding: '6px 12px',
    textAlign: 'right',
    fontSize: '13px',
    fontWeight: '500',
  };
}
