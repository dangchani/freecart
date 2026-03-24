import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const sendVerificationSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = sendVerificationSchema.parse(body);

    const supabase = await createClient();

    // Check if user is authenticated (resend for logged-in user) or sending for a specific email
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // If authenticated, use the authenticated user's email
    const targetEmail = user ? user.email ?? email : email;

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: targetEmail,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: '인증 이메일 발송 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: '인증 이메일이 발송되었습니다. 이메일을 확인해 주세요.',
        email: targetEmail,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '올바른 이메일 주소를 입력해 주세요.' },
        { status: 400 }
      );
    }
    console.error('Send verification error:', error);
    return NextResponse.json(
      { success: false, error: '인증 이메일 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
