import { createClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookLog {
  id: string;
  webhook_id: string;
  event: string;
  payload: Record<string, unknown>;
  status: string;
  response_code: number | null;
  response_body: string | null;
  duration_ms: number | null;
  sent_at: string | null;
  created_at: string;
}

export interface InboundWebhook {
  id: string;
  source: string;
  label: string;
  secret_key: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InboundWebhookLog {
  id: string;
  source: string;
  event_type: string | null;
  payload: Record<string, unknown>;
  is_verified: boolean;
  received_at: string;
}

// ---------------------------------------------------------------------------
// 발신 웹훅 CRUD
// ---------------------------------------------------------------------------

export async function getWebhookConfigs(): Promise<WebhookConfig[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('webhook_configs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createWebhookConfig(
  payload: Pick<WebhookConfig, 'name' | 'url' | 'events'> & { secret?: string | null },
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('webhook_configs').insert({
    name:      payload.name,
    url:       payload.url,
    secret:    payload.secret ?? null,
    events:    payload.events,
    is_active: true,
  });
  if (error) throw error;
}

export async function updateWebhookConfig(
  id: string,
  payload: Partial<Pick<WebhookConfig, 'name' | 'url' | 'events' | 'is_active'> & { secret?: string | null }>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('webhook_configs')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteWebhookConfig(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('webhook_configs').delete().eq('id', id);
  if (error) throw error;
}

export async function getWebhookLogs(webhookId: string, limit = 20): Promise<WebhookLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('webhook_id', webhookId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// 발신 웹훅 트리거
// 이벤트 발생 시 이 함수를 호출하면 구독 중인 모든 웹훅에 Edge Function으로 전송합니다.
// fire-and-forget 방식으로 사용 — await 없이 .catch(() => {}) 패턴 권장
// ---------------------------------------------------------------------------

export async function triggerWebhook(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const supabase = createClient();

  // 해당 이벤트를 구독 중인 활성 웹훅 조회
  const { data: configs } = await supabase
    .from('webhook_configs')
    .select('id')
    .eq('is_active', true)
    .contains('events', [eventType]);

  if (!configs || configs.length === 0) return;

  // 각 웹훅에 대해 Edge Function 호출 (병렬)
  await Promise.allSettled(
    configs.map((cfg) =>
      supabase.functions.invoke('send-webhook', {
        body: { webhook_id: cfg.id, event_type: eventType, payload },
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// 수신 웹훅 관리
// ---------------------------------------------------------------------------

export async function getInboundWebhooks(): Promise<InboundWebhook[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('inbound_webhooks')
    .select('*')
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function upsertInboundWebhook(
  source: string,
  payload: { label?: string; secret_key?: string | null; is_active?: boolean },
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('inbound_webhooks')
    .upsert({ source, ...payload, updated_at: new Date().toISOString() }, { onConflict: 'source' });
  if (error) throw error;
}

export async function regenerateInboundSecret(source: string): Promise<string> {
  const newSecret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  await upsertInboundWebhook(source, { secret_key: newSecret });
  return newSecret;
}

export async function getInboundWebhookLogs(source: string, limit = 30): Promise<InboundWebhookLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('inbound_webhook_logs')
    .select('*')
    .eq('source', source)
    .order('received_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
