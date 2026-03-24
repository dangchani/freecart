import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'edge';

const updateAdminSchema = z.object({
  role: z.enum(['admin', 'super_admin']).optional(),
  is_active: z.boolean().optional(),
  name: z.string().min(1).max(100).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ adminId: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { adminId } = await params;

    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role, is_active, created_at, last_sign_in_at, phone')
      .eq('id', adminId)
      .in('role', ['admin', 'super_admin'])
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: '관리자를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, error: '관리자 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ adminId: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { adminId } = await params;

    // Prevent self-modification of role/active status
    if (adminId === user.id) {
      return NextResponse.json(
        { success: false, error: '자신의 관리자 권한은 수정할 수 없습니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const updateData = updateAdminSchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: '변경할 내용이 없습니다.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', adminId)
      .in('role', ['admin', 'super_admin'])
      .select('id, email, name, role, is_active, created_at')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ success: false, error: '관리자를 찾을 수 없습니다.' }, { status: 404 });
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
      { success: false, error: '관리자 정보 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ adminId: string }> }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { adminId } = await params;

    // Prevent self-removal
    if (adminId === user.id) {
      return NextResponse.json(
        { success: false, error: '자신의 관리자 권한은 제거할 수 없습니다.' },
        { status: 400 }
      );
    }

    // Demote to regular user (set role to 'user')
    const { data, error } = await supabase
      .from('users')
      .update({ role: 'user' })
      .eq('id', adminId)
      .in('role', ['admin', 'super_admin'])
      .select('id, email, name, role')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ success: false, error: '관리자를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `${data.name || data.email}의 관리자 권한이 제거되었습니다.`,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: '관리자 권한 제거 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
