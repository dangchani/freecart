import { createClient } from '@/lib/supabase/client';

export type EasyPayProvider = 'kakaopay' | 'naverpay' | 'samsungpay' | 'payco' | 'toss';

export interface EasyPayConfig {
  provider: EasyPayProvider;
  name: string;
  clientId: string;
  isActive: boolean;
}

export interface EasyPayRequest {
  orderId: string;
  orderName: string;
  amount: number;
  itemName: string;
  quantity: number;
  userId?: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
}

// 간편결제 설정 가져오기
export async function getEasyPayConfigs(): Promise<EasyPayConfig[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('easy_payment_configs')
    .select('provider, name, client_id, is_active')
    .eq('is_active', true);

  if (error || !data) return [];

  return data.map((c: any) => ({
    provider: c.provider as EasyPayProvider,
    name: c.name,
    clientId: c.client_id,
    isActive: c.is_active,
  }));
}

// 카카오페이 결제 요청
export async function requestKakaoPay(payment: EasyPayRequest): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase.functions.invoke('kakaopay-ready', {
    body: {
      partner_order_id: payment.orderId,
      partner_user_id: payment.userId || 'guest',
      item_name: payment.itemName,
      quantity: payment.quantity,
      total_amount: payment.amount,
      approval_url: payment.successUrl,
      cancel_url: payment.cancelUrl,
      fail_url: payment.failUrl,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  // 카카오페이 결제 준비 응답에서 redirect_url 반환
  return data.next_redirect_pc_url || data.next_redirect_mobile_url;
}

// 네이버페이 결제 요청
export async function requestNaverPay(payment: EasyPayRequest): Promise<void> {
  // @ts-ignore - Naver Pay SDK
  const naverPay = window.Naver?.Pay;

  if (!naverPay) {
    throw new Error('네이버페이 SDK가 로드되지 않았습니다.');
  }

  const oPay = naverPay.create({
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    clientId: await getNaverPayClientId(),
    chainId: await getNaverPayChainId(),
  });

  oPay.open({
    merchantPayKey: payment.orderId,
    productName: payment.orderName,
    totalPayAmount: payment.amount,
    taxScopeAmount: payment.amount,
    taxExScopeAmount: 0,
    returnUrl: payment.successUrl,
  });
}

async function getNaverPayClientId(): Promise<string> {
  const configs = await getEasyPayConfigs();
  const naverpay = configs.find((c) => c.provider === 'naverpay');
  return naverpay?.clientId || '';
}

async function getNaverPayChainId(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase
    .from('easy_payment_configs')
    .select('settings')
    .eq('provider', 'naverpay')
    .single();
  return data?.settings?.chain_id || '';
}

// 삼성페이 결제 요청
export async function requestSamsungPay(payment: EasyPayRequest): Promise<void> {
  // @ts-ignore - Samsung Pay SDK
  const samsungPay = window.SamsungPay;

  if (!samsungPay) {
    throw new Error('삼성페이 SDK가 로드되지 않았습니다.');
  }

  samsungPay.init({
    serviceId: await getSamsungPayServiceId(),
  });

  samsungPay.connect({
    transactionId: payment.orderId,
    callback: payment.successUrl,
    paymentDetails: {
      orderNumber: payment.orderId,
      merchantName: '프리카트',
      amount: {
        total: payment.amount,
        currency: 'KRW',
      },
    },
  });
}

async function getSamsungPayServiceId(): Promise<string> {
  const configs = await getEasyPayConfigs();
  const samsungpay = configs.find((c) => c.provider === 'samsungpay');
  return samsungpay?.clientId || '';
}

// 토스 간편결제 요청
export async function requestTossPay(payment: EasyPayRequest): Promise<void> {
  // @ts-ignore - TossPayments SDK
  const tossPayments = window.TossPayments;

  if (!tossPayments) {
    throw new Error('토스페이먼츠 SDK가 로드되지 않았습니다.');
  }

  const configs = await getEasyPayConfigs();
  const toss = configs.find((c) => c.provider === 'toss');

  if (!toss) {
    throw new Error('토스페이 설정이 없습니다.');
  }

  const payments = tossPayments(toss.clientId);

  await payments.requestPayment('토스페이', {
    amount: payment.amount,
    orderId: payment.orderId,
    orderName: payment.orderName,
    successUrl: payment.successUrl,
    failUrl: payment.failUrl,
  });
}

// 간편결제 SDK 로드
export function loadEasyPaySDK(provider: EasyPayProvider): Promise<void> {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[data-easypay="${provider}"]`);
    if (existingScript) {
      resolve();
      return;
    }

    let src = '';
    switch (provider) {
      case 'kakaopay':
        // 카카오페이는 서버 사이드 처리
        resolve();
        return;
      case 'naverpay':
        src = 'https://nsp.pay.naver.com/sdk/js/naverpay.min.js';
        break;
      case 'samsungpay':
        src = 'https://img.mpay.samsung.com/gsmpi/sdk/samsungpay_web_sdk.js';
        break;
      case 'toss':
        src = 'https://js.tosspayments.com/v1/payment';
        break;
      default:
        reject(new Error(`Unknown easy pay provider: ${provider}`));
        return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute('data-easypay', provider);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${provider} SDK`));
    document.head.appendChild(script);
  });
}

// 범용 간편결제 요청
export async function requestEasyPayment(
  provider: EasyPayProvider,
  payment: EasyPayRequest
): Promise<string | void> {
  await loadEasyPaySDK(provider);

  switch (provider) {
    case 'kakaopay':
      return await requestKakaoPay(payment);
    case 'naverpay':
      return await requestNaverPay(payment);
    case 'samsungpay':
      return await requestSamsungPay(payment);
    case 'toss':
      return await requestTossPay(payment);
    default:
      throw new Error(`지원하지 않는 간편결제입니다: ${provider}`);
  }
}

// 간편결제 승인 (카카오페이)
export async function approveKakaoPay(
  pgToken: string,
  orderId: string,
  userId: string
): Promise<any> {
  const supabase = createClient();

  const { data, error } = await supabase.functions.invoke('kakaopay-approve', {
    body: {
      pg_token: pgToken,
      partner_order_id: orderId,
      partner_user_id: userId,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// 간편결제 취소
export async function cancelEasyPayment(
  provider: EasyPayProvider,
  paymentKey: string,
  cancelReason: string,
  cancelAmount?: number
): Promise<any> {
  const supabase = createClient();

  const { data, error } = await supabase.functions.invoke('cancel-easy-payment', {
    body: {
      provider,
      payment_key: paymentKey,
      cancel_reason: cancelReason,
      cancel_amount: cancelAmount,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// 간편결제 아이콘/로고 URL
export const EASY_PAY_ICONS: Record<EasyPayProvider, string> = {
  kakaopay: '/icons/kakaopay.svg',
  naverpay: '/icons/naverpay.svg',
  samsungpay: '/icons/samsungpay.svg',
  payco: '/icons/payco.svg',
  toss: '/icons/toss.svg',
};

// 간편결제 표시 이름
export const EASY_PAY_NAMES: Record<EasyPayProvider, string> = {
  kakaopay: '카카오페이',
  naverpay: '네이버페이',
  samsungpay: '삼성페이',
  payco: '페이코',
  toss: '토스페이',
};
