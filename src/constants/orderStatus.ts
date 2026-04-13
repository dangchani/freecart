// 주문 상태 전이 규칙 & 레이블
// Phase 1: Order Status State Machine
// Phase 2: OrderItemStatus 추가

export type OrderStatus =
  | 'pending'           // 입금대기
  | 'paid'              // 입금확인
  | 'processing'        // 상품준비중
  | 'shipped'           // 배송중
  | 'delivered'         // 배송완료
  | 'confirmed'         // 구매확정
  | 'cancelled'         // 취소완료
  | 'return_requested'  // 반품신청
  | 'returned';         // 반품완료

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'partial_cancelled'
  | 'cancelled'
  | 'failed';

/** 각 상태에서 전이 가능한 다음 상태 목록 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:          ['paid', 'cancelled'],
  paid:             ['processing', 'pending', 'cancelled'],
  processing:       ['shipped', 'paid', 'cancelled'],
  shipped:          ['delivered', 'processing'],
  delivered:        ['confirmed', 'return_requested'],
  confirmed:        [],
  cancelled:        [],
  return_requested: ['returned'],
  returned:         [],
};

/** 한국어 라벨 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending:          '입금대기',
  paid:             '입금확인',
  processing:       '상품준비중',
  shipped:          '배송중',
  delivered:        '배송완료',
  confirmed:        '구매확정',
  cancelled:        '취소완료',
  return_requested: '반품신청',
  returned:         '반품완료',
};

/** 관리자 화면용 배지 색상 (Tailwind) */
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending:          'bg-yellow-100 text-yellow-800',
  paid:             'bg-blue-100 text-blue-800',
  processing:       'bg-indigo-100 text-indigo-800',
  shipped:          'bg-purple-100 text-purple-800',
  delivered:        'bg-teal-100 text-teal-800',
  confirmed:        'bg-green-100 text-green-800',
  cancelled:        'bg-red-100 text-red-800',
  return_requested: 'bg-orange-100 text-orange-800',
  returned:         'bg-gray-100 text-gray-800',
};

/** 최종 상태 (더 이상 전이 불가) */
export const ORDER_FINAL_STATUSES: OrderStatus[] = ['confirmed', 'cancelled', 'returned'];

/** 취소 가능한 상태 */
export const ORDER_CANCELLABLE_STATUSES: OrderStatus[] = ['pending', 'paid', 'processing'];

/** 상태 전이가 유효한지 검증 */
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** 취소 가능한 주문 상태인지 확인 */
export function isCancellable(status: OrderStatus): boolean {
  return ORDER_CANCELLABLE_STATUSES.includes(status);
}

// =============================================================================
// 주문 아이템 개별 상태 (order_items.status)
// =============================================================================

export type OrderItemStatus =
  | 'pending'    // 정상 (기본값)
  | 'returned'   // 반품처리 완료
  | 'exchanged'  // 교환처리 완료
  | 'cancelled'; // 취소

export const ORDER_ITEM_STATUS_LABELS: Record<OrderItemStatus, string> = {
  pending:   '정상',
  returned:  '반품처리',
  exchanged: '교환처리',
  cancelled: '취소',
};

export const ORDER_ITEM_STATUS_COLORS: Record<OrderItemStatus, string> = {
  pending:   'bg-gray-100 text-gray-700',
  returned:  'bg-orange-100 text-orange-800',
  exchanged: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
};

/** 반품/교환 처리가 가능한 주문 상태 */
export const ORDER_RETURNABLE_STATUSES: OrderStatus[] = [
  'delivered', 'confirmed', 'return_requested', 'returned',
];
