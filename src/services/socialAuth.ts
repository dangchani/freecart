import { createClient } from '@/lib/supabase/client';

export type SocialProvider = 'kakao' | 'naver' | 'google' | 'apple';

export interface SocialAuthConfig {
  provider: SocialProvider;
  clientId: string;
  callbackUrl: string;
}

// 소셜 로그인 URL 생성
export async function getSocialLoginUrl(provider: SocialProvider): Promise<string> {
  const supabase = createClient();

  const redirectTo = `${window.location.origin}/auth/callback`;

  let oauthProvider: 'kakao' | 'google' | 'apple' | undefined;

  switch (provider) {
    case 'kakao':
      oauthProvider = 'kakao';
      break;
    case 'google':
      oauthProvider = 'google';
      break;
    case 'apple':
      oauthProvider = 'apple';
      break;
    case 'naver':
      // 네이버는 Supabase에서 직접 지원하지 않으므로 커스텀 구현 필요
      return getNaverLoginUrl();
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: oauthProvider,
    options: {
      redirectTo,
      queryParams: provider === 'kakao' ? { prompt: 'select_account' } : undefined,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data.url || '';
}

// 네이버 로그인 URL 생성
function getNaverLoginUrl(): string {
  const clientId = import.meta.env.VITE_NAVER_CLIENT_ID || '';
  const redirectUri = encodeURIComponent(`${window.location.origin}/auth/naver/callback`);
  const state = generateState();

  sessionStorage.setItem('naver_oauth_state', state);

  return `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`;
}

// CSRF 방지용 state 생성
function generateState(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// 네이버 로그인 콜백 처리
export async function handleNaverCallback(
  code: string,
  state: string
): Promise<{ success: boolean; error?: string }> {
  const savedState = sessionStorage.getItem('naver_oauth_state');
  if (state !== savedState) {
    return { success: false, error: '잘못된 요청입니다.' };
  }

  sessionStorage.removeItem('naver_oauth_state');

  const supabase = createClient();

  // Edge Function을 통해 네이버 토큰 교환 및 사용자 정보 조회
  const { data, error } = await supabase.functions.invoke('naver-auth', {
    body: { code },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // 반환된 세션으로 로그인 처리
  if (data.session) {
    await supabase.auth.setSession(data.session);
  }

  return { success: true };
}

// 소셜 계정 연동
export async function linkSocialAccount(
  userId: string,
  provider: SocialProvider,
  socialId: string,
  email?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // 이미 연동되어 있는지 확인
  const { data: existing } = await supabase
    .from('user_social_accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single();

  if (existing) {
    return { success: false, error: '이미 연동된 계정입니다.' };
  }

  const { error } = await supabase.from('user_social_accounts').insert({
    user_id: userId,
    provider,
    social_id: socialId,
    email,
  });

  if (error) {
    return { success: false, error: '계정 연동에 실패했습니다.' };
  }

  return { success: true };
}

// 소셜 계정 연동 해제
export async function unlinkSocialAccount(
  userId: string,
  provider: SocialProvider
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // 다른 로그인 수단이 있는지 확인
  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  const { data: socialAccounts } = await supabase
    .from('user_social_accounts')
    .select('provider')
    .eq('user_id', userId);

  // 이메일 계정이 없고, 다른 소셜 계정도 없으면 해제 불가
  if (!user?.email && (socialAccounts?.length || 0) <= 1) {
    return { success: false, error: '마지막 로그인 수단은 해제할 수 없습니다.' };
  }

  const { error } = await supabase
    .from('user_social_accounts')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) {
    return { success: false, error: '연동 해제에 실패했습니다.' };
  }

  return { success: true };
}

// 연동된 소셜 계정 목록
export async function getLinkedSocialAccounts(
  userId: string
): Promise<{ provider: SocialProvider; email?: string; linkedAt: string }[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('user_social_accounts')
    .select('provider, email, created_at')
    .eq('user_id', userId);

  if (error || !data) return [];

  return data.map((a: any) => ({
    provider: a.provider,
    email: a.email,
    linkedAt: a.created_at,
  }));
}

// 소셜 로그인 제공자 정보
export const SOCIAL_PROVIDERS: Record<
  SocialProvider,
  { name: string; icon: string; color: string }
> = {
  kakao: {
    name: '카카오',
    icon: '/icons/kakao.svg',
    color: '#FEE500',
  },
  naver: {
    name: '네이버',
    icon: '/icons/naver.svg',
    color: '#03C75A',
  },
  google: {
    name: '구글',
    icon: '/icons/google.svg',
    color: '#FFFFFF',
  },
  apple: {
    name: '애플',
    icon: '/icons/apple.svg',
    color: '#000000',
  },
};
