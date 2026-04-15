import { createClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

export interface IntegrationField {
  key: string;
  label: string;
  type: 'text' | 'password';
  required?: boolean;
  placeholder?: string;
}

export interface IntegrationProvider {
  key: string;
  name: string;
  category: string;
  description: string | null;
  fields: IntegrationField[];
  hasTest: boolean;
  sortOrder: number;
}

export interface IntegrationInstance {
  platform: string;
  credentials: Record<string, string>;
  isActive: boolean;
  lastSyncAt: string | null;
}

// ---------------------------------------------------------------------------
// 카탈로그 조회
// ---------------------------------------------------------------------------

export async function getIntegrationProviders(): Promise<IntegrationProvider[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('integration_providers')
    .select('key, name, category, description, fields, has_test, sort_order')
    .order('sort_order');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    key:         r.key,
    name:        r.name,
    category:    r.category,
    description: r.description,
    fields:      r.fields as IntegrationField[],
    hasTest:     r.has_test,
    sortOrder:   r.sort_order,
  }));
}

// ---------------------------------------------------------------------------
// 설치 상태 조회
// ---------------------------------------------------------------------------

export async function getIntegrationInstances(): Promise<IntegrationInstance[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('external_connections')
    .select('platform, credentials, is_active, last_sync_at');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    platform:    r.platform,
    credentials: (r.credentials ?? {}) as Record<string, string>,
    isActive:    r.is_active,
    lastSyncAt:  r.last_sync_at ?? null,
  }));
}

// ---------------------------------------------------------------------------
// 저장 (upsert)
// ---------------------------------------------------------------------------

export async function saveIntegrationCredentials(
  platform: string,
  credentials: Record<string, string>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('external_connections')
    .upsert(
      {
        platform,
        name:        platform,
        credentials,
        config:      {},
        is_active:   true,
        last_sync_at: new Date().toISOString(),
      },
      { onConflict: 'platform' },
    );
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// 연동 해제
// ---------------------------------------------------------------------------

export async function disableIntegration(platform: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('external_connections')
    .update({ is_active: false, credentials: {} })
    .eq('platform', platform);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// 클라이언트 커스터마이징용 유틸 함수
// 실제 API 호출 로직은 이 함수로 credentials를 꺼내서 구현
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 카탈로그 관리 (관리자 직접 추가/삭제)
// ---------------------------------------------------------------------------

export async function addIntegrationProvider(
  provider: Omit<IntegrationProvider, 'sortOrder'> & { sortOrder?: number },
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('integration_providers').insert({
    key:         provider.key,
    name:        provider.name,
    category:    provider.category,
    description: provider.description ?? null,
    fields:      provider.fields,
    has_test:    provider.hasTest,
    sort_order:  provider.sortOrder ?? 99,
  });
  if (error) throw error;
}

export async function deleteIntegrationProvider(key: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('integration_providers')
    .delete()
    .eq('key', key);
  if (error) throw error;
}

/**
 * 연동 서비스의 저장된 credentials를 반환합니다.
 * 미연동이거나 비활성화된 경우 null을 반환합니다.
 *
 * @example
 * const creds = await getIntegrationCredentials('ecount');
 * if (creds) {
 *   // creds.company_code, creds.user_id, creds.api_key 사용
 * }
 */
export async function getIntegrationCredentials(
  platform: string,
): Promise<Record<string, string> | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('external_connections')
    .select('credentials, is_active')
    .eq('platform', platform)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.is_active) return null;
  return (data.credentials ?? {}) as Record<string, string>;
}

/**
 * 연동 서비스가 활성화되어 있는지 확인합니다.
 */
export async function isIntegrationEnabled(platform: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from('external_connections')
    .select('is_active')
    .eq('platform', platform)
    .maybeSingle();
  return data?.is_active === true;
}
