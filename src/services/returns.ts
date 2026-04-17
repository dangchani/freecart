/**
 * @deprecated returns 테이블이 refunds(type='return')로 통합되었습니다.
 * 이 파일은 하위 호환성을 위한 re-export shim입니다.
 * 새 코드에서는 @/services/refund 를 직접 사용하세요.
 */

export type {
  ReturnItem,
  ReturnableItem,
} from '@/services/refund';

export {
  RETURN_REASONS,
  getReturnableItems,
  calculateReturnRefundAmount,
  createAdminReturn,
  completeReturn,
  updateReturnTracking as updateReturnCollectTracking,
} from '@/services/refund';

// 하위 호환: ReturnStatus → RefundStatus 별칭
export type ReturnStatus = 'pending' | 'approved' | 'rejected' | 'collected' | 'completed';

// 하위 호환: ReturnRequest → RefundRequest 별칭
export type { RefundRequest as ReturnRequest } from '@/services/refund';

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  pending:   '검토중',
  approved:  '승인됨',
  rejected:  '거부됨',
  collected: '수거완료',
  completed: '완료',
};

// 하위 호환: 반품(type='return') 목록만 조회
export async function getAllReturnRequests(filters?: {
  status?: ReturnStatus;
  dateFrom?: string;
  dateTo?: string;
}) {
  const { getAllRefundRequests } = await import('@/services/refund');
  return getAllRefundRequests({ ...filters, type: 'return' });
}

// 하위 호환: 반품 승인 → approveRefund 위임
export async function approveReturn(returnId: string, adminMemo?: string) {
  const { approveRefund } = await import('@/services/refund');
  return approveRefund(returnId, adminMemo);
}

// 하위 호환: 반품 거부 → rejectRefund 위임
export async function rejectReturn(returnId: string, reason: string) {
  const { rejectRefund } = await import('@/services/refund');
  return rejectRefund(returnId, reason);
}

export const RETURN_REASONS_DEPRECATED = [
  { value: 'change_of_mind',   label: '단순 변심' },
  { value: 'defective',        label: '상품 불량' },
  { value: 'wrong_product',    label: '오배송' },
  { value: 'not_as_described', label: '상품 정보 상이' },
  { value: 'late_delivery',    label: '배송 지연' },
  { value: 'other',            label: '기타' },
];
