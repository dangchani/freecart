import { createClient } from '@/lib/supabase/client';

export type PaymentProvider = 'toss' | 'kcp' | 'nicepay' | 'inicis' | 'kiwoom';

export interface PaymentGatewayConfig {
  provider: PaymentProvider;
  name: string;
  clientKey: string;
  isActive: boolean;
  settings?: Record<string, string>;
}

export interface PaymentRequest {
  orderId: string;
  orderName: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  successUrl: string;
  failUrl: string;
}

export interface PaymentResult {
  success: boolean;
  paymentKey?: string;
  orderId?: string;
  amount?: number;
  method?: string;
  error?: string;
}

// 활성화된 PG 설정 가져오기
export async function getActivePaymentGateway(): Promise<PaymentGatewayConfig | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('payment_gateways')
    .select('provider, name, client_key, is_active, settings')
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  return {
    provider: data.provider as PaymentProvider,
    name: data.name,
    clientKey: data.client_key || '',
    isActive: data.is_active,
    settings: data.settings,
  };
}

// 모든 PG 설정 가져오기
export async function getAllPaymentGateways(): Promise<PaymentGatewayConfig[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('payment_gateways')
    .select('provider, name, client_key, is_active, settings');

  if (error || !data) return [];

  return data.map((g: any) => ({
    provider: g.provider as PaymentProvider,
    name: g.name,
    clientKey: g.client_key || '',
    isActive: g.is_active,
    settings: g.settings,
  }));
}

// 토스페이먼츠 결제창 호출
export async function requestTossPayment(
  clientKey: string,
  payment: PaymentRequest
): Promise<void> {
  // @ts-ignore - TossPayments는 외부 스크립트에서 로드됨
  const tossPayments = window.TossPayments?.(clientKey);

  if (!tossPayments) {
    throw new Error('토스페이먼츠 SDK가 로드되지 않았습니다.');
  }

  await tossPayments.requestPayment('카드', {
    amount: payment.amount,
    orderId: payment.orderId,
    orderName: payment.orderName,
    customerName: payment.customerName,
    customerEmail: payment.customerEmail,
    successUrl: payment.successUrl,
    failUrl: payment.failUrl,
  });
}

// KCP 결제창 호출
export async function requestKcpPayment(
  siteCode: string,
  payment: PaymentRequest
): Promise<void> {
  // KCP는 서버 사이드 인증이 필요하므로 폼 기반으로 처리
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = 'https://pay.kcp.co.kr/plugin/payplus.jsp';
  form.target = '_self';

  const fields = {
    site_cd: siteCode,
    ordr_idxx: payment.orderId,
    good_name: payment.orderName,
    good_mny: payment.amount.toString(),
    buyr_name: payment.customerName,
    buyr_mail: payment.customerEmail,
    buyr_tel1: payment.customerPhone || '',
    pay_method: 'CARD',
    quotaopt: '12',
    Ret_URL: payment.successUrl,
    escw_used: 'N',
  };

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

// 나이스페이 결제창 호출
export async function requestNicepayPayment(
  clientId: string,
  payment: PaymentRequest
): Promise<void> {
  // @ts-ignore - NICEPAY는 외부 스크립트에서 로드됨
  const nicepay = window.NICEPAY;

  if (!nicepay) {
    throw new Error('나이스페이 SDK가 로드되지 않았습니다.');
  }

  nicepay.requestPayment({
    clientId,
    method: 'card',
    orderId: payment.orderId,
    amount: payment.amount,
    goodsName: payment.orderName,
    buyerName: payment.customerName,
    buyerEmail: payment.customerEmail,
    buyerTel: payment.customerPhone,
    returnUrl: payment.successUrl,
    mallReserved: '',
  });
}

// KG이니시스 결제창 호출
export async function requestInicisPayment(
  mid: string,
  payment: PaymentRequest
): Promise<void> {
  // @ts-ignore - INIStdPay는 외부 스크립트에서 로드됨
  const iniPay = window.INIStdPay;

  if (!iniPay) {
    throw new Error('이니시스 SDK가 로드되지 않았습니다.');
  }

  iniPay.pay({
    version: '1.0',
    mid,
    oid: payment.orderId,
    goodname: payment.orderName,
    price: payment.amount,
    buyername: payment.customerName,
    buyeremail: payment.customerEmail,
    buyertel: payment.customerPhone,
    gopaymethod: 'Card',
    acceptmethod: 'HPP(1)',
    returnUrl: payment.successUrl,
    closeUrl: payment.failUrl,
  });
}

// 범용 결제 요청 함수
export async function requestPayment(payment: PaymentRequest): Promise<void> {
  const gateway = await getActivePaymentGateway();

  if (!gateway) {
    throw new Error('활성화된 결제 수단이 없습니다.');
  }

  switch (gateway.provider) {
    case 'toss':
      await requestTossPayment(gateway.clientKey, payment);
      break;
    case 'kcp':
      await requestKcpPayment(gateway.clientKey, payment);
      break;
    case 'nicepay':
      await requestNicepayPayment(gateway.clientKey, payment);
      break;
    case 'inicis':
      await requestInicisPayment(gateway.clientKey, payment);
      break;
    default:
      throw new Error(`지원하지 않는 결제 수단입니다: ${gateway.provider}`);
  }
}

// 결제 확인 (서버 사이드에서 호출해야 함)
export async function confirmPayment(
  provider: PaymentProvider,
  paymentKey: string,
  orderId: string,
  amount: number
): Promise<PaymentResult> {
  // 이 함수는 실제로는 Supabase Edge Function에서 실행되어야 함
  // 클라이언트에서는 Edge Function을 호출하는 방식으로 처리

  const supabase = createClient();

  const { data, error } = await supabase.functions.invoke('confirm-payment', {
    body: { provider, paymentKey, orderId, amount },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as PaymentResult;
}

// 결제 취소 (서버 사이드에서 호출해야 함)
export async function cancelPayment(
  provider: PaymentProvider,
  paymentKey: string,
  cancelReason: string,
  cancelAmount?: number
): Promise<PaymentResult> {
  const supabase = createClient();

  const { data, error } = await supabase.functions.invoke('cancel-payment', {
    body: { provider, paymentKey, cancelReason, cancelAmount },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as PaymentResult;
}

// 주문에 결제 정보 저장
export async function savePaymentInfo(
  orderId: string,
  paymentInfo: {
    provider: PaymentProvider;
    paymentKey: string;
    method: string;
    amount: number;
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
  }
): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase.from('order_payments').insert({
    order_id: orderId,
    provider: paymentInfo.provider,
    payment_key: paymentInfo.paymentKey,
    method: paymentInfo.method,
    amount: paymentInfo.amount,
    status: paymentInfo.status,
  });

  return !error;
}

// 가상계좌 정보 저장
export async function saveVirtualAccountInfo(
  orderId: string,
  accountInfo: {
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    dueDate: string;
    amount: number;
  }
): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase.from('order_virtual_accounts').insert({
    order_id: orderId,
    bank_code: accountInfo.bankCode,
    bank_name: accountInfo.bankName,
    account_number: accountInfo.accountNumber,
    account_holder: accountInfo.accountHolder,
    due_date: accountInfo.dueDate,
    amount: accountInfo.amount,
    status: 'pending',
  });

  return !error;
}

// PG SDK 스크립트 로드
export function loadPaymentSDK(provider: PaymentProvider): Promise<void> {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[data-pg="${provider}"]`);
    if (existingScript) {
      resolve();
      return;
    }

    let src = '';
    switch (provider) {
      case 'toss':
        src = 'https://js.tosspayments.com/v1/payment';
        break;
      case 'nicepay':
        src = 'https://pay.nicepay.co.kr/v1/js/';
        break;
      case 'inicis':
        src = 'https://stdpay.inicis.com/stdjs/INIStdPay.js';
        break;
      case 'kcp':
        // KCP는 서버 사이드 처리이므로 SDK 불필요
        resolve();
        return;
      default:
        reject(new Error(`Unknown provider: ${provider}`));
        return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute('data-pg', provider);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${provider} SDK`));
    document.head.appendChild(script);
  });
}

// 결제 수단 목록
export const PAYMENT_METHODS = [
  { value: 'card', label: '신용/체크카드' },
  { value: 'virtual_account', label: '가상계좌' },
  { value: 'transfer', label: '실시간 계좌이체' },
  { value: 'phone', label: '휴대폰 결제' },
  { value: 'kakaopay', label: '카카오페이' },
  { value: 'naverpay', label: '네이버페이' },
  { value: 'samsungpay', label: '삼성페이' },
  { value: 'payco', label: '페이코' },
];

// 은행 목록
export const BANK_LIST = [
  { code: '004', name: 'KB국민은행' },
  { code: '011', name: 'NH농협은행' },
  { code: '020', name: '우리은행' },
  { code: '081', name: '하나은행' },
  { code: '088', name: '신한은행' },
  { code: '003', name: 'IBK기업은행' },
  { code: '027', name: '씨티은행' },
  { code: '031', name: 'DGB대구은행' },
  { code: '032', name: '부산은행' },
  { code: '034', name: '광주은행' },
  { code: '035', name: '제주은행' },
  { code: '037', name: '전북은행' },
  { code: '039', name: '경남은행' },
  { code: '045', name: '새마을금고' },
  { code: '048', name: '신협' },
  { code: '071', name: '우체국' },
  { code: '089', name: '케이뱅크' },
  { code: '090', name: '카카오뱅크' },
  { code: '092', name: '토스뱅크' },
];
