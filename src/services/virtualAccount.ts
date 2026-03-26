import { createClient } from '@/lib/supabase/client';

export interface VirtualAccountInfo {
  id: string;
  orderId: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'deposited' | 'expired' | 'cancelled';
  depositedAt?: string;
}

export interface BankTransferConfig {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isActive: boolean;
}

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

// 무통장 입금 계좌 설정 가져오기
export async function getBankTransferConfigs(): Promise<BankTransferConfig[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('bank_transfer_accounts')
    .select('id, bank_code, bank_name, account_number, account_holder, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error || !data) return [];

  return data.map((b: any) => ({
    id: b.id,
    bankCode: b.bank_code,
    bankName: b.bank_name,
    accountNumber: b.account_number,
    accountHolder: b.account_holder,
    isActive: b.is_active,
  }));
}

// 가상계좌 발급 요청
export async function requestVirtualAccount(
  orderId: string,
  bankCode: string,
  amount: number,
  customerName: string,
  dueHours: number = 24
): Promise<VirtualAccountInfo> {
  const supabase = createClient();

  // PG사를 통한 가상계좌 발급 (Edge Function 호출)
  const { data, error } = await supabase.functions.invoke('issue-virtual-account', {
    body: {
      order_id: orderId,
      bank_code: bankCode,
      amount,
      customer_name: customerName,
      due_hours: dueHours,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  // DB에 가상계좌 정보 저장
  const dueDate = new Date();
  dueDate.setHours(dueDate.getHours() + dueHours);

  const bankName = BANK_LIST.find((b) => b.code === bankCode)?.name || bankCode;

  const { data: savedAccount, error: saveError } = await supabase
    .from('order_virtual_accounts')
    .insert({
      order_id: orderId,
      bank_code: bankCode,
      bank_name: bankName,
      account_number: data.account_number,
      account_holder: data.account_holder,
      amount,
      due_date: dueDate.toISOString(),
      status: 'pending',
    })
    .select()
    .single();

  if (saveError) {
    throw new Error('가상계좌 정보 저장에 실패했습니다.');
  }

  return {
    id: savedAccount.id,
    orderId: savedAccount.order_id,
    bankCode: savedAccount.bank_code,
    bankName: savedAccount.bank_name,
    accountNumber: savedAccount.account_number,
    accountHolder: savedAccount.account_holder,
    amount: savedAccount.amount,
    dueDate: savedAccount.due_date,
    status: savedAccount.status,
  };
}

// 무통장 입금 주문 생성
export async function createBankTransferOrder(
  orderId: string,
  bankAccountId: string,
  amount: number,
  depositorName: string,
  dueHours: number = 24
): Promise<VirtualAccountInfo> {
  const supabase = createClient();

  // 선택한 입금 계좌 정보 가져오기
  const { data: bankAccount, error: bankError } = await supabase
    .from('bank_transfer_accounts')
    .select('bank_code, bank_name, account_number, account_holder')
    .eq('id', bankAccountId)
    .single();

  if (bankError || !bankAccount) {
    throw new Error('입금 계좌 정보를 찾을 수 없습니다.');
  }

  const dueDate = new Date();
  dueDate.setHours(dueDate.getHours() + dueHours);

  // 입금 정보 저장
  const { data: savedAccount, error: saveError } = await supabase
    .from('order_virtual_accounts')
    .insert({
      order_id: orderId,
      bank_code: bankAccount.bank_code,
      bank_name: bankAccount.bank_name,
      account_number: bankAccount.account_number,
      account_holder: bankAccount.account_holder,
      amount,
      depositor_name: depositorName,
      due_date: dueDate.toISOString(),
      status: 'pending',
      is_virtual: false, // 무통장 입금 (가상계좌 아님)
    })
    .select()
    .single();

  if (saveError) {
    throw new Error('입금 정보 저장에 실패했습니다.');
  }

  return {
    id: savedAccount.id,
    orderId: savedAccount.order_id,
    bankCode: savedAccount.bank_code,
    bankName: savedAccount.bank_name,
    accountNumber: savedAccount.account_number,
    accountHolder: savedAccount.account_holder,
    amount: savedAccount.amount,
    dueDate: savedAccount.due_date,
    status: savedAccount.status,
  };
}

// 주문의 가상계좌/무통장 입금 정보 조회
export async function getOrderVirtualAccount(orderId: string): Promise<VirtualAccountInfo | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('order_virtual_accounts')
    .select('*')
    .eq('order_id', orderId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    orderId: data.order_id,
    bankCode: data.bank_code,
    bankName: data.bank_name,
    accountNumber: data.account_number,
    accountHolder: data.account_holder,
    amount: data.amount,
    dueDate: data.due_date,
    status: data.status,
    depositedAt: data.deposited_at,
  };
}

// 입금 확인 (관리자용)
export async function confirmDeposit(
  virtualAccountId: string,
  adminMemo?: string
): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('order_virtual_accounts')
    .update({
      status: 'deposited',
      deposited_at: new Date().toISOString(),
      admin_memo: adminMemo,
    })
    .eq('id', virtualAccountId);

  if (error) return false;

  // 연결된 주문 상태도 업데이트
  const { data: account } = await supabase
    .from('order_virtual_accounts')
    .select('order_id')
    .eq('id', virtualAccountId)
    .single();

  if (account) {
    await supabase
      .from('orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', account.order_id);
  }

  return true;
}

// 입금 대기 중인 주문 목록 (관리자용)
export async function getPendingDeposits(): Promise<VirtualAccountInfo[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('order_virtual_accounts')
    .select('*')
    .eq('status', 'pending')
    .order('due_date', { ascending: true });

  if (error || !data) return [];

  return data.map((d: any) => ({
    id: d.id,
    orderId: d.order_id,
    bankCode: d.bank_code,
    bankName: d.bank_name,
    accountNumber: d.account_number,
    accountHolder: d.account_holder,
    amount: d.amount,
    dueDate: d.due_date,
    status: d.status,
    depositedAt: d.deposited_at,
  }));
}

// 만료된 가상계좌 처리 (스케줄러에서 호출)
export async function processExpiredAccounts(): Promise<number> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('order_virtual_accounts')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('due_date', new Date().toISOString())
    .select('order_id');

  if (error || !data) return 0;

  // 연결된 주문도 취소 처리
  const orderIds = data.map((d: any) => d.order_id);
  if (orderIds.length > 0) {
    await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancel_reason: '입금 기한 초과',
      })
      .in('id', orderIds);
  }

  return data.length;
}

// 가상계좌 입금 알림 처리 (웹훅용)
export async function handleDepositNotification(
  accountNumber: string,
  amount: number,
  depositorName: string
): Promise<boolean> {
  const supabase = createClient();

  // 해당 계좌번호와 금액으로 대기 중인 입금 찾기
  const { data: account, error } = await supabase
    .from('order_virtual_accounts')
    .select('id, order_id, amount')
    .eq('account_number', accountNumber)
    .eq('status', 'pending')
    .single();

  if (error || !account) return false;

  // 금액 확인
  if (account.amount !== amount) {
    console.warn(`금액 불일치: 예상 ${account.amount}, 실제 ${amount}`);
    return false;
  }

  // 입금 확인 처리
  await confirmDeposit(account.id, `자동 입금 확인 - 입금자: ${depositorName}`);

  return true;
}

// 남은 입금 시간 계산
export function getRemainingTime(dueDate: string): {
  expired: boolean;
  hours: number;
  minutes: number;
  text: string;
} {
  const now = new Date();
  const due = new Date(dueDate);
  const diff = due.getTime() - now.getTime();

  if (diff <= 0) {
    return { expired: true, hours: 0, minutes: 0, text: '입금 기한 만료' };
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return {
    expired: false,
    hours,
    minutes,
    text: `${hours}시간 ${minutes}분 남음`,
  };
}
