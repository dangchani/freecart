/**
 * freecart-web OAuth 2.0 클라이언트
 * freecart(쇼핑몰) → freecart-web(마켓플레이스) 연동
 */

import { createClient } from '@/lib/supabase/client';
import { getSetting } from '@/services/settings';

const AES_KEY_SETTING = 'oauth_aes_key';

// ─── 토큰 암호화 (AES-GCM, 브라우저 Web Crypto API) ────────────────────────

async function getOrCreateAesKey(): Promise<CryptoKey> {
  const supabase = createClient();
  const { data } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', AES_KEY_SETTING)
    .single();

  let rawKey: Uint8Array;
  if (data?.value) {
    rawKey = Uint8Array.from(atob(data.value), (c) => c.charCodeAt(0));
  } else {
    rawKey = crypto.getRandomValues(new Uint8Array(32));
    const b64 = btoa(String.fromCharCode(...rawKey));
    await supabase.from('site_settings').upsert({ key: AES_KEY_SETTING, value: b64 });
  }

  return crypto.subtle.importKey('raw', rawKey.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encrypt(text: string): Promise<string> {
  const key = await getOrCreateAesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(b64: string): Promise<string> {
  const key = await getOrCreateAesKey();
  const combined = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
}

// ─── DB 저장/조회 ────────────────────────────────────────────────────────────

export interface OAuthConnection {
  freecartUserEmail: string;
  connectedAt: string;
  tokenExpiresAt: string;
}

async function saveTokens(accessToken: string, refreshToken: string, expiresAt: Date, email: string) {
  const supabase = createClient();
  const [encAccess, encRefresh] = await Promise.all([encrypt(accessToken), encrypt(refreshToken)]);
  await supabase.from('freecart_integration').upsert({
    id: 1,
    access_token_encrypted: encAccess,
    refresh_token_encrypted: encRefresh,
    freecart_user_email: email,
    token_expires_at: expiresAt.toISOString(),
    connected_at: new Date().toISOString(),
  });
}

async function loadTokens(): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date } | null> {
  const supabase = createClient();
  const { data } = await supabase.from('freecart_integration').select('*').eq('id', 1).single();
  if (!data) return null;
  try {
    const [access, refresh] = await Promise.all([
      decrypt(data.access_token_encrypted),
      decrypt(data.refresh_token_encrypted),
    ]);
    return { accessToken: access, refreshToken: refresh, expiresAt: new Date(data.token_expires_at) };
  } catch {
    return null;
  }
}

// ─── 공개 API ────────────────────────────────────────────────────────────────

export async function getOAuthConnection(): Promise<OAuthConnection | null> {
  const supabase = createClient();
  const { data } = await supabase.from('freecart_integration').select('freecart_user_email, connected_at, token_expires_at').eq('id', 1).single();
  return data ? { freecartUserEmail: data.freecart_user_email, connectedAt: data.connected_at, tokenExpiresAt: data.token_expires_at } : null;
}

export async function disconnectOAuth() {
  const supabase = createClient();
  await supabase.from('freecart_integration').delete().eq('id', 1);
  // 서버에 토큰 폐기 요청
  const tokens = await loadTokens().catch(() => null);
  if (tokens) {
    const storeApiUrl = await getSetting('store_api_url', '');
    if (storeApiUrl) {
      await fetch(`${storeApiUrl}/api/oauth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: tokens.accessToken }),
      }).catch(() => {});
    }
  }
}

/**
 * OAuth 팝업 열기 → code 수신 → token 교환
 */
export async function startOAuthFlow(): Promise<{ success: boolean; email?: string; error?: string }> {
  const storeApiUrl = await getSetting('store_api_url', '');
  if (!storeApiUrl) return { success: false, error: '스토어 API URL을 먼저 설정해주세요.' };

  const clientId     = import.meta.env.VITE_OAUTH_CLIENT_ID     || await getSetting('oauth_client_id', '');
  const clientSecret = import.meta.env.VITE_OAUTH_CLIENT_SECRET || await getSetting('oauth_client_secret', '');
  if (!clientId || !clientSecret) return { success: false, error: 'OAuth 클라이언트 정보가 설정되지 않았습니다.' };

  const redirectUri = `${window.location.origin}/admin/oauth/callback`;
  const state = crypto.randomUUID();

  // state 임시 저장
  sessionStorage.setItem('oauth_state', state);

  const authUrl = `${storeApiUrl}/api/oauth/authorize?` + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read',
    state,
  });

  return new Promise((resolve) => {
    const popup = window.open(authUrl, 'freecart_oauth', 'width=480,height=640,scrollbars=yes');
    if (!popup) return resolve({ success: false, error: '팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.' });

    let timer: ReturnType<typeof setInterval>;
    let messageReceived = false;

    const handler = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'OAUTH_CALLBACK') return;

      messageReceived = true;
      clearInterval(timer); // 팝업 닫힘 감지 타이머 중지
      window.removeEventListener('message', handler);
      popup.close();

      const { code, state: returnedState, error } = event.data;
      if (error) return resolve({ success: false, error: `OAuth 오류: ${error}` });
      if (returnedState !== sessionStorage.getItem('oauth_state')) {
        return resolve({ success: false, error: 'state 불일치 (CSRF 의심)' });
      }

      // code → token 교환
      try {
        const res = await fetch(`${storeApiUrl}/api/oauth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }),
        });
        const tokenData = await res.json();
        if (!res.ok || !tokenData.access_token) return resolve({ success: false, error: tokenData.error || '토큰 발급 실패' });

        // 사용자 정보 조회
        const meRes = await fetch(`${storeApiUrl}/api/oauth/me`, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const meData = await meRes.json();

        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
        await saveTokens(tokenData.access_token, tokenData.refresh_token, expiresAt, meData.data?.email || '');

        resolve({ success: true, email: meData.data?.email });
      } catch (err) {
        resolve({ success: false, error: '토큰 교환 중 오류가 발생했습니다.' });
      }
    };

    window.addEventListener('message', handler);

    // 팝업이 닫히면 취소 처리 (메시지를 받지 못한 경우만)
    timer = setInterval(() => {
      if (popup.closed && !messageReceived) {
        clearInterval(timer);
        window.removeEventListener('message', handler);
        resolve({ success: false, error: '연동이 취소되었습니다.' });
      }
    }, 500);
  });
}

/**
 * access_token 반환 (만료 시 자동 갱신)
 */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await loadTokens();
  if (!tokens) return null;

  if (tokens.expiresAt > new Date(Date.now() + 60 * 1000)) {
    return tokens.accessToken;
  }

  // 토큰 갱신
  const storeApiUrl = await getSetting('store_api_url', '');
  const clientId     = import.meta.env.VITE_OAUTH_CLIENT_ID     || await getSetting('oauth_client_id', '');
  const clientSecret = import.meta.env.VITE_OAUTH_CLIENT_SECRET || await getSetting('oauth_client_secret', '');
  if (!storeApiUrl || !clientId || !clientSecret) return null;

  try {
    const res = await fetch(`${storeApiUrl}/api/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken, client_id: clientId, client_secret: clientSecret }),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) return null;

    const expiresAt = new Date(Date.now() + data.expires_in * 1000);
    const supabase = createClient();
    const { data: conn } = await supabase.from('freecart_integration').select('freecart_user_email').eq('id', 1).single();
    await saveTokens(data.access_token, data.refresh_token, expiresAt, conn?.freecart_user_email || '');
    return data.access_token;
  } catch {
    return null;
  }
}
