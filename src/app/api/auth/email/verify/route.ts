import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const verifyEmailSchema = z.object({
  token: z.string(),
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, email } = verifyEmailSchema.parse(body);

    const supabase = await createClient();

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error || !data.user) {
      return NextResponse.json(
        { success: false, error: '유효하지 않거나 만료된 인증 토큰입니다.' },
        { status: 400 }
      );
    }

    // Update is_email_verified in users table
    await supabase
      .from('users')
      .update({ is_email_verified: true })
      .eq('id', data.user.id);

    return NextResponse.json({
      success: true,
      data: {
        message: '이메일 인증이 완료되었습니다.',
        user: data.user,
        session: data.session,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    console.error('Email verify error:', error);
    return NextResponse.json(
      { success: false, error: '이메일 인증 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
