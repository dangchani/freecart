// joy: 관리자 활동 로그 기록 헬퍼 (admin_logs)
// 실패해도 호출자의 원본 작업을 막지 않도록 조용히 삼키고 console에만 남김.
import { createClient } from '@/lib/supabase/client';

export type AdminLogAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'block'
  | 'unblock'
  | 'password_reset'
  | 'adjust_points'
  | 'change_level'
  | 'update_memo';

interface LogParams {
  action: AdminLogAction | string;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
}

/**
 * 관리자 액션을 admin_logs 에 기록한다.
 * - 민감정보(password_hash 등)는 호출자가 details 에서 제외할 것.
 * - 실패는 throw 하지 않는다. 로깅 실패가 본 작업을 막으면 안 되기 때문.
 */
export async function logAdminAction(params: LogParams): Promise<void> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('admin_logs').insert({
      admin_id: user?.id ?? null,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId ?? null,
      details: params.details ?? null,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[admin-log] failed to write log', e);
  }
}

/**
 * before / after 두 객체를 비교해 변경된 키만 뽑아 로그용 diff 객체를 만든다.
 * password_hash 같은 민감 키는 sensitive 배열로 전달하면 값 없이 'changed' 표시만 남김.
 */
export function buildDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  sensitive: string[] = [],
): { changedFields: string[]; before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const changed: string[] = [];
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (before[k] !== after[k]) {
      changed.push(k);
      if (sensitive.includes(k)) {
        b[k] = '***';
        a[k] = '***';
      } else {
        b[k] = before[k] ?? null;
        a[k] = after[k] ?? null;
      }
    }
  }
  if (changed.length === 0) return null;
  return { changedFields: changed, before: b, after: a };
}
