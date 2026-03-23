import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const SUPPORTED_PROVIDERS = ['kakao', 'naver', 'google'] as const;
type SocialProvider = (typeof SUPPORTED_PROVIDERS)[number];

interface SocialUserInfo {
  id: string;
  email: string;
  name: string;
}

async function getKakaoUserInfo(accessToken: string): Promise<SocialUserInfo> {
  const res = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('카카오 인증 실패');
  const data = await res.json();
  return {
    id: String(data.id),
    email: data.kakao_account?.email || '',
    name: data.kakao_account?.profile?.nickname || '사용자',
  };
}

async function getNaverUserInfo(accessToken: string): Promise<SocialUserInfo> {
  const res = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('네이버 인증 실패');
  const data = await res.json();
  return {
    id: data.response.id,
    email: data.response.email || '',
    name: data.response.name || '사용자',
  };
}

async function getGoogleUserInfo(accessToken: string): Promise<SocialUserInfo> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('구글 인증 실패');
  const data = await res.json();
  return {
    id: data.sub,
    email: data.email || '',
    name: data.name || '사용자',
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const provider = params.provider as SocialProvider;

    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { success: false, error: '지원하지 않는 소셜 로그인입니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { accessToken } = z.object({ accessToken: z.string() }).parse(body);

    const supabase = await createClient();

    // Get user info from social provider
    let socialUserInfo: SocialUserInfo;
    if (provider === 'kakao') {
      socialUserInfo = await getKakaoUserInfo(accessToken);
    } else if (provider === 'naver') {
      socialUserInfo = await getNaverUserInfo(accessToken);
    } else {
      socialUserInfo = await getGoogleUserInfo(accessToken);
    }

    if (!socialUserInfo.email) {
      return NextResponse.json(
        { success: false, error: '소셜 계정에서 이메일 정보를 가져올 수 없습니다.' },
        { status: 400 }
      );
    }

    // Check if social account already exists
    const { data: existingSocial } = await supabase
      .from('user_social_accounts')
      .select('user_id')
      .eq('provider', provider)
      .eq('provider_id', socialUserInfo.id)
      .single();

    let userId: string;

    if (existingSocial) {
      userId = existingSocial.user_id;
    } else {
      // Check if user exists with this email
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', socialUserInfo.email)
        .single();

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create new auth user
        const tempPassword = crypto.randomUUID() + Math.random().toString(36).slice(-8);
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: socialUserInfo.email,
          password: tempPassword,
        });
        if (authError || !authData.user) {
          return NextResponse.json(
            { success: false, error: '회원가입 중 오류가 발생했습니다.' },
            { status: 500 }
          );
        }
        userId = authData.user.id;

        // Get default level
        const { data: defaultLevel } = await supabase
          .from('user_levels')
          .select('id')
          .eq('is_default', true)
          .single();

        await supabase.from('users').insert({
          id: userId,
          email: socialUserInfo.email,
          name: socialUserInfo.name,
          level_id: defaultLevel?.id ?? null,
          is_email_verified: true,
          privacy_agreed_at: new Date().toISOString(),
          terms_agreed_at: new Date().toISOString(),
        });
      }

      // Link social account
      await supabase.from('user_social_accounts').insert({
        user_id: userId,
        provider,
        provider_id: socialUserInfo.id,
        provider_email: socialUserInfo.email,
      });
    }

    // Fetch full user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*, level:user_levels(id, name, level, discount_rate, point_rate)')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: '사용자 정보를 불러오는 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user: userData,
        provider,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    console.error('Social login error:', error);
    return NextResponse.json(
      { success: false, error: '소셜 로그인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
