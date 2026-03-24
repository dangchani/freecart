import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    const supabase = await createClient();

    // Check if user exists (do not reveal existence for security, but still useful for internal logic)
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    // Always return success to prevent email enumeration attacks
    if (!existingUser) {
      return NextResponse.json({
        success: true,
        data: {
          message: '비밀번호 재설정 이메일이 발송되었습니다. 이메일을 확인해 주세요.',
        },
      });
    }

    const redirectUrl =
      process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`
        : `${request.nextUrl.origin}/auth/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: '비밀번호 재설정 이메일 발송 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: '비밀번호 재설정 이메일이 발송되었습니다. 이메일을 확인해 주세요.',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '올바른 이메일 주소를 입력해 주세요.' },
        { status: 400 }
      );
    }
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, error: '비밀번호 재설정 요청 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
