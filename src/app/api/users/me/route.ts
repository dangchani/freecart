import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateProfileSchema = z.object({
  name: z.string().min(2, '이름은 최소 2자 이상이어야 합니다.').optional(),
  nickname: z.string().min(2, '닉네임은 최소 2자 이상이어야 합니다.').optional(),
  phone: z.string().regex(/^01[0-9]{8,9}$/, '올바른 전화번호 형식이 아닙니다.').optional(),
  profile_image: z.string().url().optional(),
  marketing_agreed: z.boolean().optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('users')
      .select('*, level:user_levels(id, name, level, discount_rate, point_rate)')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: '사용자 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('GET /users/me error:', error);
    return NextResponse.json(
      { success: false, error: '사용자 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const updates = updateProfileSchema.parse(body);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: '변경할 내용이 없습니다.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('*, level:user_levels(id, name, level, discount_rate, point_rate)')
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: '사용자 정보 업데이트 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message ?? '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    console.error('PATCH /users/me error:', error);
    return NextResponse.json(
      { success: false, error: '사용자 정보 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Soft delete: mark user as deleted rather than hard delete
    const { error: updateError } = await supabase
      .from('users')
      .update({
        deleted_at: new Date().toISOString(),
        email: `deleted_${user.id}@deleted.invalid`,
        name: '탈퇴한 회원',
        phone: null,
        profile_image: null,
      })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: '회원 탈퇴 처리 중 오류가 발생했습니다.' },
        { status: 400 }
      );
    }

    // Sign out the user
    await supabase.auth.signOut();

    return NextResponse.json({
      success: true,
      data: { message: '회원 탈퇴가 완료되었습니다.' },
    });
  } catch (error) {
    console.error('DELETE /users/me error:', error);
    return NextResponse.json(
      { success: false, error: '회원 탈퇴 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
