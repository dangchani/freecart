/** 공통 래퍼 */
function layout(title: string, body: string, siteName: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Apple SD Gothic Neo',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <!-- 헤더 -->
        <tr>
          <td style="background:#1a1a1a;padding:20px 32px;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;">${siteName}</span>
          </td>
        </tr>
        <!-- 본문 -->
        <tr>
          <td style="padding:32px;">
            ${body}
          </td>
        </tr>
        <!-- 푸터 -->
        <tr>
          <td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:11px;color:#999;line-height:1.6;">
              본 메일은 발신 전용입니다. 문의사항은 고객센터를 이용해 주세요.<br />
              © ${siteName}. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** 배송 시작 이메일 */
export function buildShippedEmail(data: {
  orderNumber: string;
  trackingNumber?: string;
  shippingCompany?: string;
  recipientName?: string;
  siteName?: string;
}): { subject: string; html: string } {
  const name = data.siteName || '쇼핑몰';
  const subject = `[${name}] 주문번호 ${data.orderNumber} 배송이 시작되었습니다`;

  const trackingBlock = data.trackingNumber
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:6px;margin:20px 0;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0 0 8px;font-size:12px;color:#666;">택배사</p>
            <p style="margin:0;font-size:15px;font-weight:600;color:#1a1a1a;">${data.shippingCompany || '-'}</p>
            <p style="margin:12px 0 8px;font-size:12px;color:#666;">운송장 번호</p>
            <p style="margin:0;font-size:18px;font-weight:700;color:#2563eb;letter-spacing:1px;">${data.trackingNumber}</p>
          </td>
        </tr>
      </table>`
    : '';

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;">배송이 시작되었습니다 🚚</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#555;">
      ${data.recipientName ? `${data.recipientName}님, ` : ''}주문하신 상품이 배송을 시작했습니다.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;margin-bottom:20px;">
      <tr>
        <td style="padding:14px 20px;border-bottom:1px solid #eee;background:#fafafa;">
          <span style="font-size:12px;color:#666;">주문번호</span>
        </td>
        <td style="padding:14px 20px;border-bottom:1px solid #eee;">
          <span style="font-size:14px;font-weight:600;color:#1a1a1a;">${data.orderNumber}</span>
        </td>
      </tr>
    </table>

    ${trackingBlock}

    <p style="margin:20px 0 0;font-size:13px;color:#888;line-height:1.6;">
      배송 조회는 택배사 홈페이지에서 운송장 번호로 확인하실 수 있습니다.<br />
      배송 완료 후 구매 확정을 해주시면 포인트가 적립됩니다.
    </p>`;

  return { subject, html: layout(subject, body, name) };
}

/** 주문 완료 이메일 */
export function buildOrderPlacedEmail(data: {
  orderNumber: string;
  ordererName?: string;
  items: Array<{ productName: string; optionText?: string; quantity: number; unitPrice: number }>;
  subtotal: number;
  shippingFee: number;
  discountAmount?: number;
  totalAmount: number;
  paymentMethod: string;
  paymentDeadline?: string | null;
  siteName?: string;
}): { subject: string; html: string } {
  const name = data.siteName || '쇼핑몰';
  const subject = `[${name}] 주문번호 ${data.orderNumber} 주문이 접수되었습니다`;

  const paymentMethodLabel: Record<string, string> = {
    bank_transfer: '무통장입금',
    virtual_account: '가상계좌',
    card: '신용카드',
    cash: '현금',
    other: '기타',
  };

  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">
          <p style="margin:0;font-size:14px;color:#1a1a1a;font-weight:500;">${item.productName}</p>
          ${item.optionText ? `<p style="margin:2px 0 0;font-size:12px;color:#888;">${item.optionText}</p>` : ''}
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:center;white-space:nowrap;">
          <span style="font-size:13px;color:#555;">${item.quantity}개</span>
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;white-space:nowrap;">
          <span style="font-size:13px;color:#1a1a1a;">${(item.unitPrice * item.quantity).toLocaleString()}원</span>
        </td>
      </tr>`,
    )
    .join('');

  const deadlineBlock =
    data.paymentDeadline
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0;border:1px solid #fde8c8;border-radius:6px;margin:20px 0;">
          <tr>
            <td style="padding:14px 20px;">
              <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
                <strong>입금 기한:</strong>
                ${new Date(data.paymentDeadline).toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}까지
                입금해 주세요. 기한 내 미입금 시 주문이 자동 취소됩니다.
              </p>
            </td>
          </tr>
        </table>`
      : '';

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;">주문이 접수되었습니다</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#555;">
      ${data.ordererName ? `${data.ordererName}님, ` : ''}주문해 주셔서 감사합니다.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;margin-bottom:20px;">
      <tr style="background:#fafafa;">
        <td style="padding:10px 16px;border-bottom:1px solid #eee;">
          <span style="font-size:12px;color:#666;">주문번호</span>
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #eee;">
          <span style="font-size:14px;font-weight:600;color:#1a1a1a;">${data.orderNumber}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 16px;background:#fafafa;border-bottom:1px solid #eee;">
          <span style="font-size:12px;color:#666;">결제 수단</span>
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #eee;">
          <span style="font-size:14px;color:#1a1a1a;">${paymentMethodLabel[data.paymentMethod] ?? data.paymentMethod}</span>
        </td>
      </tr>
    </table>

    ${deadlineBlock}

    <!-- 주문 상품 -->
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1a1a1a;">주문 상품</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;margin-bottom:20px;">
      <thead>
        <tr style="background:#fafafa;">
          <th style="padding:10px 16px;text-align:left;font-size:12px;color:#666;font-weight:500;border-bottom:1px solid #eee;">상품명</th>
          <th style="padding:10px 16px;text-align:center;font-size:12px;color:#666;font-weight:500;border-bottom:1px solid #eee;">수량</th>
          <th style="padding:10px 16px;text-align:right;font-size:12px;color:#666;font-weight:500;border-bottom:1px solid #eee;">금액</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <!-- 금액 요약 -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;margin-bottom:20px;">
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">
          <span style="font-size:13px;color:#666;">상품 금액</span>
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;">
          <span style="font-size:13px;color:#1a1a1a;">${data.subtotal.toLocaleString()}원</span>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">
          <span style="font-size:13px;color:#666;">배송비</span>
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;">
          <span style="font-size:13px;color:#1a1a1a;">${data.shippingFee === 0 ? '무료' : `${data.shippingFee.toLocaleString()}원`}</span>
        </td>
      </tr>
      ${(data.discountAmount ?? 0) > 0 ? `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">
          <span style="font-size:13px;color:#666;">할인</span>
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;">
          <span style="font-size:13px;color:#dc2626;">-${(data.discountAmount!).toLocaleString()}원</span>
        </td>
      </tr>` : ''}
      <tr style="background:#fafafa;">
        <td style="padding:12px 16px;">
          <span style="font-size:14px;font-weight:700;color:#1a1a1a;">최종 결제금액</span>
        </td>
        <td style="padding:12px 16px;text-align:right;">
          <span style="font-size:16px;font-weight:700;color:#2563eb;">${data.totalAmount.toLocaleString()}원</span>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
      주문 내역은 마이페이지에서 확인하실 수 있습니다.<br />
      문의사항은 고객센터를 이용해 주세요.
    </p>`;

  return { subject, html: layout(subject, body, name) };
}

/** 주문 취소 이메일 */
export function buildCancelledEmail(data: {
  orderNumber: string;
  cancelReason?: string;
  ordererName?: string;
  totalAmount?: number;
  siteName?: string;
}): { subject: string; html: string } {
  const name = data.siteName || '쇼핑몰';
  const subject = `[${name}] 주문번호 ${data.orderNumber} 취소가 완료되었습니다`;

  const body = `
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;">주문이 취소되었습니다</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#555;">
      ${data.ordererName ? `${data.ordererName}님의 ` : ''}주문이 취소 처리되었습니다.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;margin-bottom:20px;">
      <tr>
        <td style="padding:14px 20px;border-bottom:1px solid #eee;background:#fafafa;width:120px;">
          <span style="font-size:12px;color:#666;">주문번호</span>
        </td>
        <td style="padding:14px 20px;border-bottom:1px solid #eee;">
          <span style="font-size:14px;font-weight:600;color:#1a1a1a;">${data.orderNumber}</span>
        </td>
      </tr>
      ${data.totalAmount != null ? `
      <tr>
        <td style="padding:14px 20px;border-bottom:1px solid #eee;background:#fafafa;">
          <span style="font-size:12px;color:#666;">결제금액</span>
        </td>
        <td style="padding:14px 20px;border-bottom:1px solid #eee;">
          <span style="font-size:14px;color:#1a1a1a;">${data.totalAmount.toLocaleString()}원</span>
        </td>
      </tr>` : ''}
      ${data.cancelReason ? `
      <tr>
        <td style="padding:14px 20px;background:#fafafa;">
          <span style="font-size:12px;color:#666;">취소 사유</span>
        </td>
        <td style="padding:14px 20px;">
          <span style="font-size:14px;color:#1a1a1a;">${data.cancelReason}</span>
        </td>
      </tr>` : ''}
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f0;border:1px solid #fde8c8;border-radius:6px;margin-bottom:20px;">
      <tr>
        <td style="padding:14px 20px;">
          <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
            결제 취소는 카드사/PG사 정책에 따라 3~5 영업일 이내 처리됩니다.<br />
            사용하신 포인트·예치금은 자동으로 복구됩니다.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:#888;">
      취소 관련 문의사항은 고객센터로 연락해 주세요.
    </p>`;

  return { subject, html: layout(subject, body, name) };
}
