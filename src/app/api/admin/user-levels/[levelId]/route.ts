import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const updateUserLevelSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().optional().nullable(),
  discount_rate: z.number().min(0).max(100).optional(),
  point_rate: z.number().min(0).max(100).optional(),
  min_purchase_amount: z.number().int().min(0).optional(),
  min_purchase_count: z.number().int().min(0).optional(),
  conditions: z.record(z.unknown()).optional().nullable(),
  is_default: z.boolean().optional(),
  color: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ levelId: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { levelId } = await params;

    const { data: level, error } = await supabase
      .from('user_levels')
      .select('*')
      .eq('id', levelId)
      .single();

    if (error || !level) {
      return NextResponse.json({ success: false, error: '회원 등급을 찾을 수 없습니다.' }, { status: 404 });
    }

    // Get user count for this level
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('level_id', levelId);

    return NextResponse.json({ success: true, data: { ...level, user_count: count || 0 } });
  } catch {
    return NextResponse.json(
      { success: false, error: '회원 등급 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ levelId: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { levelId } = await params;
    const body = await request.json();
    const updateData = updateUserLevelSchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: '변경할 내용이 없습니다.' }, { status: 400 });
    }

    // If setting as default, unset others
    if (updateData.is_default === true) {
      await supabase
        .from('user_levels')
        .update({ is_default: false })
        .eq('is_default', true)
        .neq('id', levelId);
    }

    const { data, error } = await supabase
      .from('user_levels')
      .update(updateData)
      .eq('id', levelId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ success: false, error: '회원 등급을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: '입력값이 올바르지 않습니다.', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: '회원 등급 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ levelId: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { levelId } = await params;

    const { data: level, error: levelError } = await supabase
      .from('user_levels')
      .select('id, name, is_default')
      .eq('id', levelId)
      .single();

    if (levelError || !level) {
      return NextResponse.json({ success: false, error: '회원 등급을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (level.is_default) {
      return NextResponse.json(
        { success: false, error: '기본 등급은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    // Check if any users have this level
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('level_id', levelId);

    if (count && count > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `이 등급을 사용 중인 회원이 ${count}명 있습니다. 먼저 해당 회원들의 등급을 변경해주세요.`,
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('user_levels')
      .delete()
      .eq('id', levelId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `${level.name} 등급이 삭제되었습니다.`,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '회원 등급 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
