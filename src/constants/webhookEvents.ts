// ---------------------------------------------------------------------------
// 발신 웹훅 이벤트 카탈로그
// 새 이벤트 추가 시 이 파일에만 추가하면 UI, 검증, 로그 전부 자동 반영됩니다.
// ---------------------------------------------------------------------------

export interface WebhookEventDef {
  key: string;    // 실제로 사용되는 이벤트 키 (예: 'order.created')
  label: string;  // 한국어 표시명
  group: string;  // 그룹핑용 (예: '주문')
}

export const WEBHOOK_EVENTS: WebhookEventDef[] = [
  // 주문
  { key: 'order.created',   label: '주문 생성',   group: '주문' },
  { key: 'order.paid',      label: '결제 완료',   group: '주문' },
  { key: 'order.shipped',   label: '배송 시작',   group: '주문' },
  { key: 'order.delivered', label: '배송 완료',   group: '주문' },
  { key: 'order.cancelled', label: '주문 취소',   group: '주문' },
  // 회원
  { key: 'member.created',  label: '회원 가입',   group: '회원' },
];

// 그룹 목록 (카탈로그에서 자동 추출 — 순서 유지)
export const WEBHOOK_EVENT_GROUPS: string[] = [
  ...new Set(WEBHOOK_EVENTS.map((e) => e.group)),
];

// key → label 빠른 조회 맵
export const WEBHOOK_EVENT_LABEL: Record<string, string> = Object.fromEntries(
  WEBHOOK_EVENTS.map((e) => [e.key, e.label]),
);
