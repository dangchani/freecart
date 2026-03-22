import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
});

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    if (user.id !== params.id) {
      return NextResponse.json(
        { success: false, error: '본인의 프로필만 수정할 수 있습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const profileData = updateProfileSchema.parse(body);

    const updateData: any = { updated_at: new Date().toISOString() };
    if (profileData.name !== undefined) updateData.name = profileData.name;
    if (profileData.phone !== undefined) updateData.phone = profileData.phone;

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '프로필 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }

    if (user.id !== params.id) {
      return NextResponse.json(
        { success: false, error: '본인의 계정만 삭제할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 프로필 삭제 (auth.users는 Cascade로 자동 삭제)
    const { error } = await supabase.from('profiles').delete().eq('id', params.id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    // Supabase Auth에서도 삭제
    await supabase.auth.admin.deleteUser(params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '계정 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
